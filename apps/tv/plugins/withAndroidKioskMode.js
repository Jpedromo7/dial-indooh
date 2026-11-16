const fs = require("fs");
const path = require("path");
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");

const BOOT_RECEIVER_NAME = ".BootReceiver";
const WATCHDOG_RECEIVER_NAME = ".WatchdogReceiver";
const WATCHDOG_PROVIDER_NAME = ".WatchdogInitProvider";
const BOOT_ACTIONS = [
  "android.intent.action.BOOT_COMPLETED",
  "android.intent.action.LOCKED_BOOT_COMPLETED",
  "android.intent.action.MY_PACKAGE_REPLACED",
  "android.intent.action.QUICKBOOT_POWERON",
  "com.htc.intent.action.QUICKBOOT_POWERON"
];

function withAndroidKioskMode(config) {
  config = withAndroidManifest(config, (manifestConfig) => {
    const manifest = manifestConfig.modResults.manifest;
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifestConfig.modResults);

    addPermission(manifest, "android.permission.RECEIVE_BOOT_COMPLETED");
    addPermission(manifest, "android.permission.REORDER_TASKS");
    addBootReceiver(application);
    addWatchdog(application);
    // O app NAO e mais registrado como tela inicial (launcher): isso causava o aviso
    // "Abrir com... So desta vez / Sempre". A abertura automatica e feita pelo BootReceiver e pelo vigia.
    removeHomeIntentFilter(application);

    return manifestConfig;
  });

  return withDangerousMod(config, [
    "android",
    async (dangerousConfig) => {
      const packageName = dangerousConfig.android?.package;

      if (!packageName) {
        throw new Error("android.package is required to generate the kiosk boot receiver.");
      }

      const packagePath = packageName.split(".").join(path.sep);
      const javaDir = path.join(dangerousConfig.modRequest.platformProjectRoot, "app", "src", "main", "java", packagePath);
      fs.mkdirSync(javaDir, { recursive: true });
      fs.writeFileSync(path.join(javaDir, "BootReceiver.java"), createBootReceiverSource(packageName));
      fs.writeFileSync(path.join(javaDir, "Watchdog.java"), createWatchdogSource(packageName));
      fs.writeFileSync(path.join(javaDir, "WatchdogReceiver.java"), createWatchdogReceiverSource(packageName));
      fs.writeFileSync(path.join(javaDir, "WatchdogInitProvider.java"), createWatchdogProviderSource(packageName));

      return dangerousConfig;
    }
  ]);
}

function addPermission(manifest, permissionName) {
  manifest["uses-permission"] = manifest["uses-permission"] ?? [];

  const hasPermission = manifest["uses-permission"].some((permission) => permission.$?.["android:name"] === permissionName);

  if (!hasPermission) {
    manifest["uses-permission"].push({
      $: {
        "android:name": permissionName
      }
    });
  }
}

function addBootReceiver(application) {
  application.receiver = application.receiver ?? [];
  application.receiver = application.receiver.filter((receiver) => receiver.$?.["android:name"] !== BOOT_RECEIVER_NAME);
  application.receiver.push({
    $: {
      "android:name": BOOT_RECEIVER_NAME,
      "android:directBootAware": "true",
      "android:enabled": "true",
      "android:exported": "true"
    },
    "intent-filter": [
      {
        action: BOOT_ACTIONS.map((action) => ({
          $: {
            "android:name": action
          }
        }))
      }
    ]
  });
}

function removeHomeIntentFilter(application) {
  for (const activity of application.activity ?? []) {
    if (!activity["intent-filter"]) continue;
    activity["intent-filter"] = activity["intent-filter"].filter((intentFilter) => {
      const categories = intentFilter.category?.map((category) => category.$?.["android:name"]) ?? [];
      return !categories.includes("android.intent.category.HOME");
    });
  }
}

function addWatchdog(application) {
  application.receiver = (application.receiver ?? []).filter((receiver) => receiver.$?.["android:name"] !== WATCHDOG_RECEIVER_NAME);
  application.receiver.push({
    $: {
      "android:name": WATCHDOG_RECEIVER_NAME,
      "android:enabled": "true",
      "android:exported": "false"
    }
  });

  application.provider = (application.provider ?? []).filter((provider) => provider.$?.["android:name"] !== WATCHDOG_PROVIDER_NAME);
  application.provider.push({
    $: {
      "android:name": WATCHDOG_PROVIDER_NAME,
      "android:authorities": "${applicationId}.watchdoginit",
      "android:enabled": "true",
      "android:exported": "false",
      "android:initOrder": "1"
    }
  });
}

function createBootReceiverSource(packageName) {
  return `package ${packageName};

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class BootReceiver extends BroadcastReceiver {
  @Override
  public void onReceive(Context context, Intent intent) {
    if (intent == null || intent.getAction() == null) {
      return;
    }

    String action = intent.getAction();
    if (
      Intent.ACTION_BOOT_COMPLETED.equals(action) ||
      Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(action) ||
      Intent.ACTION_MY_PACKAGE_REPLACED.equals(action) ||
      "android.intent.action.QUICKBOOT_POWERON".equals(action) ||
      "com.htc.intent.action.QUICKBOOT_POWERON".equals(action)
    ) {
      Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());

      if (launchIntent == null) {
        return;
      }

      launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      launchIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
      launchIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
      Watchdog.schedule(context);
      try {
        context.startActivity(launchIntent);
      } catch (Exception ignored) {
        // Sem permissao de sobrepor apps: o vigia tenta de novo em seguida.
      }
    }
  }
}
`;
}

function createWatchdogSource(packageName) {
  return `package ${packageName};

import android.app.ActivityManager;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.SystemClock;
import java.io.File;
import java.io.FileInputStream;

/**
 * Vigia: a cada ~minuto verifica se o app esta na tela. Se ficar fora da tela por 2 verificacoes
 * seguidas (fechou, travou, alguem saiu ou outro app abriu), traz o app de volta.
 * Pausa para manutencao: o app grava um horario (ms) no arquivo "watchdog_pause_until".
 */
public final class Watchdog {
  static final long INTERVAL_MS = 60 * 1000L;
  private static final String PREFS = "dial_watchdog";

  private Watchdog() {}

  public static void schedule(Context context) {
    AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    if (alarmManager == null) return;
    Intent intent = new Intent(context, WatchdogReceiver.class);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
    PendingIntent pending = PendingIntent.getBroadcast(context, 4242, intent, flags);
    long at = SystemClock.elapsedRealtime() + INTERVAL_MS;
    if (Build.VERSION.SDK_INT >= 23) {
      alarmManager.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, pending);
    } else {
      alarmManager.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, pending);
    }
  }

  static void check(Context context) {
    schedule(context);
    SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);

    if (isPaused(context) || isInForeground()) {
      prefs.edit().putInt("misses", 0).apply();
      return;
    }

    int misses = prefs.getInt("misses", 0) + 1;
    prefs.edit().putInt("misses", misses).apply();

    if (misses >= 2) {
      prefs.edit().putInt("misses", 0).apply();
      bringToFront(context);
    }
  }

  static boolean isInForeground() {
    ActivityManager.RunningAppProcessInfo info = new ActivityManager.RunningAppProcessInfo();
    ActivityManager.getMyMemoryState(info);
    return info.importance <= ActivityManager.RunningAppProcessInfo.IMPORTANCE_VISIBLE;
  }

  static boolean isPaused(Context context) {
    File file = new File(context.getFilesDir(), "watchdog_pause_until");
    if (!file.exists()) return false;
    try (FileInputStream input = new FileInputStream(file)) {
      byte[] buffer = new byte[32];
      int read = input.read(buffer);
      long until = Long.parseLong(new String(buffer, 0, Math.max(0, read)).trim());
      return System.currentTimeMillis() < until;
    } catch (Exception ignored) {
      return false;
    }
  }

  static void bringToFront(Context context) {
    Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
    if (launchIntent == null) return;
    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    try {
      context.startActivity(launchIntent);
    } catch (Exception ignored) {
      // Android 10+ exige a permissao "Sobrepor outros apps" para abrir em segundo plano.
    }
  }
}
`;
}

function createWatchdogReceiverSource(packageName) {
  return `package ${packageName};

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class WatchdogReceiver extends BroadcastReceiver {
  @Override
  public void onReceive(Context context, Intent intent) {
    try {
      Watchdog.check(context);
    } catch (Exception error) {
      // Ex.: armazenamento ainda bloqueado logo apos ligar. Tenta de novo no proximo ciclo.
      Watchdog.schedule(context);
    }
  }
}
`;
}

function createWatchdogProviderSource(packageName) {
  return `package ${packageName};

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;

/** Inicia o vigia sempre que o processo do app sobe (inclusive logo apos a instalacao). */
public class WatchdogInitProvider extends ContentProvider {
  @Override
  public boolean onCreate() {
    if (getContext() != null) {
      Watchdog.schedule(getContext());
    }
    return true;
  }

  @Override
  public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
    return null;
  }

  @Override
  public String getType(Uri uri) {
    return null;
  }

  @Override
  public Uri insert(Uri uri, ContentValues values) {
    return null;
  }

  @Override
  public int delete(Uri uri, String selection, String[] selectionArgs) {
    return 0;
  }

  @Override
  public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
    return 0;
  }
}
`;
}

module.exports = withAndroidKioskMode;
