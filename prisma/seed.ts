import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Admin123!", 12);

  await prisma.user.upsert({
    where: { email: "admin@dialindooh.local" },
    update: {
      name: "Demo Admin",
      passwordHash,
      role: "admin"
    },
    create: {
      name: "Demo Admin",
      email: "admin@dialindooh.local",
      passwordHash,
      role: "admin"
    }
  });

  const welcomeImage = await upsertMediaByFileUrl({
    title: "Welcome image",
    type: "image",
    fileUrl: "https://cdn.example.com/demo/welcome.jpg",
    mimeType: "image/jpeg",
    sizeBytes: BigInt(420000),
    durationSeconds: null
  });
  const menuImage = await upsertMediaByFileUrl({
    title: "Menu board",
    type: "image",
    fileUrl: "https://cdn.example.com/demo/menu.jpg",
    mimeType: "image/jpeg",
    sizeBytes: BigInt(610000),
    durationSeconds: null
  });
  const promoVideo = await upsertMediaByFileUrl({
    title: "Promo loop",
    type: "video",
    fileUrl: "https://cdn.example.com/demo/promo.mp4",
    mimeType: "video/mp4",
    sizeBytes: BigInt(8400000),
    durationSeconds: 30
  });

  const playlist = await upsertPlaylistByName({
    name: "Demo Lobby Playlist",
    description: "Sample playlist for the demo screen.",
    isActive: true
  });

  await prisma.playlistItem.deleteMany({
    where: { playlistId: playlist.id }
  });

  await prisma.playlistItem.createMany({
    data: [
      {
        playlistId: playlist.id,
        mediaId: welcomeImage.id,
        order: 1,
        displayDurationSeconds: 10
      },
      {
        playlistId: playlist.id,
        mediaId: promoVideo.id,
        order: 2,
        displayDurationSeconds: null
      },
      {
        playlistId: playlist.id,
        mediaId: menuImage.id,
        order: 3,
        displayDurationSeconds: 15
      }
    ]
  });

  const screen = await prisma.screen.upsert({
    where: { slug: "demo-lobby" },
    update: {
      name: "Demo Lobby Screen",
      activationCode: "DEMO01",
      deviceKey: null,
      location: "Lobby",
      status: "offline",
      lastSeenAt: null
    },
    create: {
      name: "Demo Lobby Screen",
      slug: "demo-lobby",
      activationCode: "DEMO01",
      location: "Lobby",
      status: "offline"
    }
  });

  await prisma.screenAssignment.deleteMany({
    where: { screenId: screen.id }
  });

  await prisma.screenAssignment.create({
    data: {
      screenId: screen.id,
      playlistId: playlist.id,
      isActive: true
    }
  });

  console.log("Seed complete:");
  console.log("  admin: admin@dialindooh.local / Admin123!");
  console.log("  screen activationCode: DEMO01");
}

async function upsertMediaByFileUrl(data: {
  title: string;
  type: "image" | "video";
  fileUrl: string;
  mimeType: string;
  sizeBytes: bigint;
  durationSeconds: number | null;
}) {
  const existingMedia = await prisma.media.findFirst({
    where: { fileUrl: data.fileUrl }
  });

  if (existingMedia) {
    return prisma.media.update({
      where: { id: existingMedia.id },
      data
    });
  }

  return prisma.media.create({ data });
}

async function upsertPlaylistByName(data: {
  name: string;
  description: string;
  isActive: boolean;
}) {
  const existingPlaylist = await prisma.playlist.findFirst({
    where: { name: data.name }
  });

  if (existingPlaylist) {
    return prisma.playlist.update({
      where: { id: existingPlaylist.id },
      data
    });
  }

  return prisma.playlist.create({ data });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
