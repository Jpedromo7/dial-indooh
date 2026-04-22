const fs = require("fs");
const path = require("path");
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");

const BOOT_RECEIVER_NAME = ".BootReceiver";
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
    addHomeIntentFilter(application);

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

function addHomeIntentFilter(application) {
  const mainActivity = application.activity?.find((activity) => {
    const activityName = activity.$?.["android:name"] ?? "";
    return activityName === ".MainActivity" || activityName.endsWith(".MainActivity");
  });

  if (!mainActivity) {
    return;
  }

  mainActivity["intent-filter"] = mainActivity["intent-filter"] ?? [];
  const hasHomeFilter = mainActivity["intent-filter"].some((intentFilter) => {
    const actions = intentFilter.action?.map((action) => action.$?.["android:name"]) ?? [];
    const categories = intentFilter.category?.map((category) => category.$?.["android:name"]) ?? [];
    return actions.includes("android.intent.action.MAIN") && categories.includes("android.intent.category.HOME");
  });

  if (!hasHomeFilter) {
    mainActivity["intent-filter"].push({
      action: [
        {
          $: {
            "android:name": "android.intent.action.MAIN"
          }
        }
      ],
      category: [
        {
          $: {
            "android:name": "android.intent.category.HOME"
          }
        },
        {
          $: {
            "android:name": "android.intent.category.DEFAULT"
          }
        }
      ]
    });
  }
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
      context.startActivity(launchIntent);
    }
  }
}
`;
}

module.exports = withAndroidKioskMode;
