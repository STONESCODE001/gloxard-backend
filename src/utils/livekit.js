import { AccessToken } from "livekit-server-sdk";
import { env } from "../config/env.js";

/**
 * Generate cryptographic LiveKit room credentials
 * Maps instructor -> "host" (can publish, record, mute), student -> "viewer"
 * @param {Object} params
 * @param {string} params.roomName
 * @param {string} params.userId
 * @param {string} [params.userName]
 * @param {string} [params.role] "host" | "viewer"
 * @returns {Promise<{ provider: string, serverUrl: string, roomToken: string, roomName: string, role: string }>}
 */
export const generateLiveKitCredentials = async ({
  roomName,
  userId,
  userName = "Participant",
  role = "viewer",
}) => {
  const isHost = role === "host";
  const apiKey = env.LIVEKIT_API_KEY || "devkey";
  const apiSecret = env.LIVEKIT_API_SECRET || "secret_mock_livekit_key_for_testing_1234567890";

  const token = new AccessToken(apiKey, apiSecret, {
    identity: String(userId),
    name: userName,
  });

  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: isHost,
    canSubscribe: true,
    canPublishData: true,
  });

  const roomToken = await token.toJwt();

  return {
    provider: "livekit",
    serverUrl: env.LIVEKIT_URL,
    roomToken,
    roomName,
    role: isHost ? "host" : "viewer",
  };
};

export default {
  generateLiveKitCredentials,
};
