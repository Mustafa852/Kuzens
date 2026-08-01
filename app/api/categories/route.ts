import { and, asc, eq } from "drizzle-orm";
import { channelCategories, channelMemberPermissionOverwrites, channelPermissionOverwrites, channels } from "@/db/schema";
import {
  DEFAULT_SERVER_ID,
  PERMISSIONS,
  requireMember,
  requirePermission,
  writeAudit,
} from "@/lib/community";
import {
  ApiError,
  apiError,
  apiJson,
  assertTrustedMutation,
  cleanText,
  enforceRateLimit,
  readJson,
  requireIdentity,
} from "@/lib/security";

type CategoryPayload = {
  action?: "reorder";
  id?: string;
  serverId?: string;
  name?: string;
  collapsedByDefault?: boolean;
  orderedIds?: string[];
};

function normalizedName(value: unknown) {
  return cleanText(value, { min: 1, max: 40 });
}

export async function GET(request: Request) {
  try {
    const identity = await requireIdentity(request);
    const serverId = cleanText(
      new URL(request.url).searchParams.get("server") || DEFAULT_SERVER_ID,
      { max: 80 },
    );
    const { db } = await requireMember(identity, serverId);
    const categories = await db
      .select()
      .from(channelCategories)
      .where(eq(channelCategories.serverId, serverId))
      .orderBy(asc(channelCategories.position));
    return apiJson({ categories });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = await requireIdentity(request);
    const payload = await readJson<CategoryPayload>(request, 4_096);
    const serverId = cleanText(payload.serverId || DEFAULT_SERVER_ID, { max: 80 });
    const { db, profile } = await requireMember(identity, serverId);
    await requirePermission(profile, PERMISSIONS.manageChannels, serverId);
    await enforceRateLimit(request, "category-create", identity.email, 12, 60 * 60_000);
    const name = normalizedName(payload.name);
    const existing = await db
      .select()
      .from(channelCategories)
      .where(eq(channelCategories.serverId, serverId));
    if (existing.some((item) => item.name.toLocaleLowerCase("tr-TR") === name.toLocaleLowerCase("tr-TR"))) {
      throw new ApiError(409, "Bu isimde bir kategori zaten var.");
    }
    const category = {
      id: `${serverId}:category:${crypto.randomUUID().slice(0, 10)}`,
      serverId,
      name,
      position: existing.length,
      collapsedByDefault: Boolean(payload.collapsedByDefault),
      createdAt: new Date().toISOString(),
    };
    await db.insert(channelCategories).values(category);
    await writeAudit(profile.id, "category.create", category.id, name, serverId);
    return apiJson({ category }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = await requireIdentity(request);
    const payload = await readJson<CategoryPayload>(request, 8_192);
    const serverId = cleanText(payload.serverId || DEFAULT_SERVER_ID, { max: 80 });
    const { db, profile } = await requireMember(identity, serverId);
    await requirePermission(profile, PERMISSIONS.manageChannels, serverId);
    await enforceRateLimit(request, "category-update", identity.email, 30, 60 * 60_000);

    if (payload.action === "reorder") {
      if (!Array.isArray(payload.orderedIds) || !payload.orderedIds.every((id) => typeof id === "string")) {
        throw new ApiError(400, "Kategori sıralaması geçersiz.");
      }
      const existing = await db
        .select({ id: channelCategories.id })
        .from(channelCategories)
        .where(eq(channelCategories.serverId, serverId));
      const expected = new Set(existing.map((item) => item.id));
      const received = new Set(payload.orderedIds);
      if (received.size !== expected.size || payload.orderedIds.length !== expected.size || payload.orderedIds.some((id) => !expected.has(id))) {
        throw new ApiError(400, "Sıralama tüm kategorileri tam olarak içermeli.");
      }
      for (const [position, id] of payload.orderedIds.entries()) {
        await db
          .update(channelCategories)
          .set({ position })
          .where(and(eq(channelCategories.id, id), eq(channelCategories.serverId, serverId)));
      }
      await writeAudit(profile.id, "category.reorder", serverId, `${received.size} kategori`, serverId);
      return apiJson({ ok: true });
    }

    const id = cleanText(payload.id, { max: 100 });
    const [existing] = await db
      .select()
      .from(channelCategories)
      .where(and(eq(channelCategories.id, id), eq(channelCategories.serverId, serverId)))
      .limit(1);
    if (!existing) throw new ApiError(404, "Kategori bulunamadı.");
    const name = normalizedName(payload.name ?? existing.name);
    const collapsedByDefault = payload.collapsedByDefault ?? existing.collapsedByDefault;
    await db
      .update(channelCategories)
      .set({ name, collapsedByDefault })
      .where(eq(channelCategories.id, id));
    await writeAudit(profile.id, "category.update", id, name, serverId);
    return apiJson({ category: { ...existing, name, collapsedByDefault } });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = await requireIdentity(request);
    const payload = await readJson<CategoryPayload>(request, 2_048);
    const serverId = cleanText(payload.serverId || DEFAULT_SERVER_ID, { max: 80 });
    const id = cleanText(payload.id, { max: 100 });
    const { db, profile } = await requireMember(identity, serverId);
    await requirePermission(profile, PERMISSIONS.manageChannels, serverId);
    await enforceRateLimit(request, "category-delete", identity.email, 12, 60 * 60_000);
    const [existing] = await db
      .select()
      .from(channelCategories)
      .where(and(eq(channelCategories.id, id), eq(channelCategories.serverId, serverId)))
      .limit(1);
    if (!existing) throw new ApiError(404, "Kategori bulunamadı.");
    await db.update(channels).set({ categoryId: null }).where(eq(channels.categoryId, id));
    await db.delete(channelCategories).where(eq(channelCategories.id, id));
    await writeAudit(profile.id, "category.delete", id, existing.name, serverId);
    return apiJson({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = await requireIdentity(request);
    const payload = await readJson<CategoryPayload & { sourceChannelId?: string }>(request, 4_096);
    const serverId = cleanText(payload.serverId || DEFAULT_SERVER_ID, { max: 80 });
    const categoryId = cleanText(payload.id, { max: 100 });
    const sourceChannelId = cleanText(payload.sourceChannelId, { max: 80 });
    const { db, profile } = await requireMember(identity, serverId);
    await requirePermission(profile, PERMISSIONS.manageChannels, serverId);
    await enforceRateLimit(request, "category-permissions", identity.email, 10, 60 * 60_000);
    const categoryChannels = await db.select().from(channels).where(and(eq(channels.serverId, serverId), eq(channels.categoryId, categoryId)));
    if (!categoryChannels.some((channel) => channel.id === sourceChannelId)) {
      throw new ApiError(400, "Kaynak oda bu kategoriye ait değil.");
    }
    const [roleOverwrites, memberOverwrites] = await Promise.all([
      db.select().from(channelPermissionOverwrites).where(eq(channelPermissionOverwrites.channelId, sourceChannelId)),
      db.select().from(channelMemberPermissionOverwrites).where(eq(channelMemberPermissionOverwrites.channelId, sourceChannelId)),
    ]);
    const targetIds = categoryChannels.map((channel) => channel.id);
    for (const channelId of targetIds) {
      await db.delete(channelPermissionOverwrites).where(eq(channelPermissionOverwrites.channelId, channelId));
      await db.delete(channelMemberPermissionOverwrites).where(eq(channelMemberPermissionOverwrites.channelId, channelId));
      if (roleOverwrites.length) {
        await db.insert(channelPermissionOverwrites).values(roleOverwrites.map((overwrite) => ({ ...overwrite, id: `${channelId}:${overwrite.roleId}`, channelId, updatedByProfileId: profile.id, updatedAt: new Date().toISOString() })));
      }
      if (memberOverwrites.length) {
        await db.insert(channelMemberPermissionOverwrites).values(memberOverwrites.map((overwrite) => ({ ...overwrite, id: `${channelId}:${overwrite.profileId}`, channelId, updatedByProfileId: profile.id, updatedAt: new Date().toISOString() })));
      }
    }
    await writeAudit(profile.id, "category.permissions.sync", categoryId, `${targetIds.length} oda`, serverId);
    return apiJson({ ok: true, channels: targetIds.length });
  } catch (error) {
    return apiError(error);
  }
}
