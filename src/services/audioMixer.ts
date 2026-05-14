// Long-lived audio graph that produces a single, stable output track for
// MediaRecorder. The microphone source is hot-swappable, so toggling /
// switching / muting the mic during recording does NOT end the recording's
// audio track — the destination keeps producing samples (silence when no
// source is connected).
//
//   micSourceNode (replaceable) → micGainNode → destinationNode → output track
//                                            ↘ analyserNode (level meter tap)
//
// The analyser is connected off micGainNode rather than the source so that:
//   - it survives source swaps without re-wiring
//   - it reflects the same signal (post-mute) that gets recorded
//
// Lazily instantiated on first use so we don't open an AudioContext until
// the user actually wants audio (browsers warn about unused contexts).

class RecordingAudioMixer {
  private audioCtx: AudioContext;
  private destinationNode: MediaStreamAudioDestinationNode;
  private micGainNode: GainNode;
  private analyserNode: AnalyserNode;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  private currentMicStream: MediaStream | null = null;

  constructor() {
    this.audioCtx = new AudioContext({ sampleRate: 48000 });
    this.destinationNode = this.audioCtx.createMediaStreamDestination();
    this.micGainNode = this.audioCtx.createGain();
    this.micGainNode.gain.value = 1;
    this.analyserNode = this.audioCtx.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.7;

    this.micGainNode.connect(this.destinationNode);
    this.micGainNode.connect(this.analyserNode);
  }

  setMicrophoneStream(stream: MediaStream | null) {
    if (stream === this.currentMicStream) return;
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    if (this.micSourceNode) {
      try {
        this.micSourceNode.disconnect();
      } catch {
        /* noop */
      }
      this.micSourceNode = null;
    }
    this.currentMicStream = stream;
    if (stream && stream.getAudioTracks().length > 0) {
      try {
        this.micSourceNode = this.audioCtx.createMediaStreamSource(stream);
        this.micSourceNode.connect(this.micGainNode);
      } catch (err) {
        console.warn('audioMixer: failed to attach mic source', err);
        this.micSourceNode = null;
      }
    }
  }

  setMicrophoneMuted(muted: boolean) {
    const now = this.audioCtx.currentTime;
    this.micGainNode.gain.setValueAtTime(muted ? 0 : 1, now);
  }

  getOutputTrack(): MediaStreamTrack {
    return this.destinationNode.stream.getAudioTracks()[0];
  }

  getAnalyserNode(): AnalyserNode {
    return this.analyserNode;
  }
}

let instance: RecordingAudioMixer | null = null;

export const getAudioMixer = (): RecordingAudioMixer => {
  if (!instance) instance = new RecordingAudioMixer();
  return instance;
};

export type { RecordingAudioMixer };
