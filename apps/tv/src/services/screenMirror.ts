import { mediaDevices, RTCIceCandidate, RTCPeerConnection, RTCSessionDescription } from "react-native-webrtc";
import type NativeMediaStream from "react-native-webrtc/lib/typescript/MediaStream";
import type NativeMediaStreamTrack from "react-native-webrtc/lib/typescript/MediaStreamTrack";
import {
  createScreenMirrorCandidate,
  fetchScreenMirrorCandidates,
  fetchScreenMirrorSession,
  updateScreenMirrorSession
} from "./apiClient";
import type { DeviceSession, ScreenMirrorSession } from "../types/signage";

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }];
const SIGNALING_POLL_MS = 1000;

type MirrorPeerConnection = RTCPeerConnection & {
  onicecandidate?: ((event: { candidate: RTCIceCandidate | null }) => void) | null;
  onconnectionstatechange?: (() => void) | null;
  connectionState?: RTCPeerConnectionState;
  addTrack?: (track: NativeMediaStreamTrack, stream: NativeMediaStream) => void;
};

interface ActiveMirrorSession {
  session: DeviceSession;
  sessionId: string;
  peerConnection: MirrorPeerConnection;
  stream: NativeMediaStream;
  pollInterval: ReturnType<typeof setInterval>;
  remoteAnswerSet: boolean;
  appliedCandidateIds: Set<string>;
}

let activeMirrorSession: ActiveMirrorSession | null = null;

export async function startScreenMirror(session: DeviceSession, mirrorSessionId: string) {
  if (activeMirrorSession?.sessionId === mirrorSessionId) {
    return;
  }

  await stopScreenMirror(false);

  let peerConnection: MirrorPeerConnection | null = null;
  let stream: NativeMediaStream | null = null;

  try {
    const displayStream = await mediaDevices.getDisplayMedia();
    stream = displayStream;
    peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS }) as MirrorPeerConnection;

    displayStream.getTracks().forEach((track) => {
      if (peerConnection?.addTrack) {
        peerConnection.addTrack(track, displayStream);
      }
    });

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }

      void createScreenMirrorCandidate(session.screenId, session.deviceKey, mirrorSessionId, {
        peer: "screen",
        candidate: serializeIceCandidate(event.candidate)
      }).catch(() => undefined);
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    await updateScreenMirrorSession(session.screenId, session.deviceKey, mirrorSessionId, {
      status: "connecting",
      offer: serializeSessionDescription(peerConnection.localDescription ?? offer)
    });

    const activeSession: ActiveMirrorSession = {
      session,
      sessionId: mirrorSessionId,
      peerConnection,
      stream,
      pollInterval: setInterval(() => void pollMirrorSignaling(), SIGNALING_POLL_MS),
      remoteAnswerSet: false,
      appliedCandidateIds: new Set()
    };

    activeMirrorSession = activeSession;
    void pollMirrorSignaling();
  } catch (error) {
    await cleanupMirrorResources(peerConnection, stream);
    await updateScreenMirrorSession(session.screenId, session.deviceKey, mirrorSessionId, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Falha ao iniciar espelhamento."
    }).catch(() => undefined);
    throw error;
  }
}

export async function stopScreenMirror(shouldNotifyServer = true) {
  const currentSession = activeMirrorSession;

  if (!currentSession) {
    return;
  }

  activeMirrorSession = null;
  clearInterval(currentSession.pollInterval);
  await cleanupMirrorResources(currentSession.peerConnection, currentSession.stream);

  if (shouldNotifyServer) {
    await updateScreenMirrorSession(currentSession.session.screenId, currentSession.session.deviceKey, currentSession.sessionId, {
      status: "ended"
    }).catch(() => undefined);
  }
}

async function pollMirrorSignaling() {
  const currentSession = activeMirrorSession;

  if (!currentSession) {
    return;
  }

  const mirrorSession = await fetchScreenMirrorSession(
    currentSession.session.screenId,
    currentSession.session.deviceKey,
    currentSession.sessionId
  );

  if (mirrorSession.status === "ended" || mirrorSession.status === "failed") {
    await stopScreenMirror(false);
    return;
  }

  await applyMirrorAnswer(currentSession, mirrorSession);
  await applyViewerCandidates(currentSession);
}

async function applyMirrorAnswer(currentSession: ActiveMirrorSession, mirrorSession: ScreenMirrorSession) {
  if (!mirrorSession.answer || currentSession.remoteAnswerSet) {
    return;
  }

  await currentSession.peerConnection.setRemoteDescription(
    new RTCSessionDescription({
      type: mirrorSession.answer.type ?? "answer",
      sdp: mirrorSession.answer.sdp ?? ""
    })
  );
  currentSession.remoteAnswerSet = true;
}

async function applyViewerCandidates(currentSession: ActiveMirrorSession) {
  if (!currentSession.remoteAnswerSet) {
    return;
  }

  const candidates = await fetchScreenMirrorCandidates(
    currentSession.session.screenId,
    currentSession.session.deviceKey,
    currentSession.sessionId
  );
  const viewerCandidates = candidates.filter(
    (candidate) => candidate.peer === "viewer" && !currentSession.appliedCandidateIds.has(candidate.id)
  );

  for (const candidate of viewerCandidates) {
    await currentSession.peerConnection.addIceCandidate(
      new RTCIceCandidate({
        candidate: candidate.candidate.candidate,
        sdpMid: candidate.candidate.sdpMid,
        sdpMLineIndex: candidate.candidate.sdpMLineIndex
      })
    );
    currentSession.appliedCandidateIds.add(candidate.id);
  }
}

async function cleanupMirrorResources(peerConnection: MirrorPeerConnection | null, stream: NativeMediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
  peerConnection?.close();
}

function serializeSessionDescription(description: { type: string | null; sdp?: string }): RTCSessionDescriptionInit {
  return {
    type: normalizeSessionDescriptionType(description.type),
    sdp: description.sdp ?? ""
  };
}

function serializeIceCandidate(candidate: RTCIceCandidate): RTCIceCandidateInit {
  const json = "toJSON" in candidate ? candidate.toJSON() : candidate;

  return {
    candidate: json.candidate,
    sdpMid: json.sdpMid,
    sdpMLineIndex: json.sdpMLineIndex
  };
}

function normalizeSessionDescriptionType(type: string | null): RTCSdpType {
  if (type === "answer" || type === "offer" || type === "pranswer" || type === "rollback") {
    return type;
  }

  return "offer";
}
