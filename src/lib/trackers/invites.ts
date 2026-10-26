// Invite links (docs/erd.md, Rules): a member creates an invite, sends the link, and whoever opens
// it while logged in joins as an editor. Invites aren't kept on the device, so these need a connection.
import { getMeta } from "@/lib/local/db";
import { createClient } from "@/lib/supabase/client";

export type InviteStatus = "valid" | "member" | "used" | "expired" | "revoked";

export type InviteDetails = {
  tracker_id: string;
  tracker_name: string;
  invited_by: string | null;
  status: InviteStatus;
  expires_at: string;
};

const OFFLINE = "You're offline. Connect to the internet to do this.";

/** Make a new invite link for a tracker. Expires in 7 days and works once. */
export async function createInviteLink(trackerId: string): Promise<{ url?: string; error?: string }> {
  if (!navigator.onLine) return { error: OFFLINE };
  const owner = await getMeta<{ userId: string }>("owner");
  if (!owner) return { error: "Not logged in." };

  const { data, error } = await createClient()
    .from("tracker_invites")
    .insert({ tracker_id: trackerId, invited_by: owner.userId })
    .select("token")
    .single();
  if (error) {
    // A tracker made offline only exists on the server after it syncs
    return { error: "Couldn't make a link yet. Wait for Kalupi to finish syncing, then try again." };
  }
  return { url: `${window.location.origin}/invite/${data.token}` };
}

/** What the invite page shows before joining. null when the link doesn't exist. */
export async function getInvite(token: string): Promise<{ invite?: InviteDetails | null; error?: string }> {
  const { data, error } = await createClient().rpc("invite_details", { p_token: token });
  if (error) return { error: navigator.onLine ? error.message : OFFLINE };
  return { invite: (data as InviteDetails[])[0] ?? null };
}

/** Join the tracker. Returns its id. */
export async function acceptInvite(token: string): Promise<{ trackerId?: string; error?: string }> {
  const { data, error } = await createClient().rpc("accept_invite", { p_token: token });
  if (error) return { error: navigator.onLine ? error.message : OFFLINE };
  return { trackerId: data as string };
}

/** Phone share sheet when there is one (Messenger, etc.), otherwise copy to the clipboard. */
export async function shareLink(url: string, trackerName: string): Promise<"shared" | "copied" | "cancelled"> {
  const text = `Save with me on Kalupi: join "${trackerName}"`;
  if (navigator.share) {
    try {
      await navigator.share({ title: trackerName, text, url });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    }
  }
  await navigator.clipboard.writeText(url);
  return "copied";
}
