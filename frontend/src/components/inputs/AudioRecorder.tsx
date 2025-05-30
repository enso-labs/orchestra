import { Square } from "lucide-react";
import { Mic } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import apiClient from "../../lib/utils/apiClient";
import { useChatContext } from "../../context/ChatContext";
import { MainToolTip } from "../tooltips/MainToolTip";

export const AudioRecorder: React.FC = () => {
  const { setPayload } = useChatContext();
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Add keyboard event handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Alt+H combination
      if (event.altKey && event.key.toLowerCase() === 'h') {
        event.preventDefault(); // Prevent default browser behavior
        
        if (recording) {
          stopRecording();
        } else {
          startRecording();
        }
      }
    };

    // Add event listener
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup event listener on unmount
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [recording]); // Include recording in dependency array so it has current state

  const analyzeAudio = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteTimeDomainData(dataArray);
    
    // Calculate RMS (Root Mean Square) for better volume detection
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const sample = (dataArray[i] - 128) / 128; // Convert to -1 to 1 range
      sum += sample * sample;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    const normalizedLevel = Math.min(rms * 5, 1); // Amplify and normalize to 0-1
    
    setAudioLevel(normalizedLevel);
    
    if (recording) {
      animationFrameRef.current = requestAnimationFrame(analyzeAudio);
    }
  };

  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Set up audio analysis
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 512; // Increase for better sensitivity
      analyserRef.current.smoothingTimeConstant = 0.3; // Reduce smoothing for more responsive bars
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("file", blob, "recording.webm");
        formData.append("model", "whisper-large-v3");
        formData.append("response_format", "verbose_json");
        formData.append("temperature", "0.0");
        formData.append("timeout", "30");
        
        try {
          const response = await apiClient.post("/llm/transcribe", formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });
          setPayload((prev: any) => ({
            ...prev,
            query: prev.query ? `${prev.query} ${response.data.transcript.text}` : response.data.transcript.text,
          }))
        } catch (error) {
          console.error('Error uploading audio:', error);
          alert("Error uploading audio");
        }
      };

      recorder.start(1000);
      setRecording(true);
      
      // Start audio analysis
      analyzeAudio();
      
    } catch (err) {
      console.error('Microphone access error:', err);
      setError('Microphone access denied. Please check your device settings and permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      // Stop all audio tracks
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    
    // Clean up audio analysis
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    setRecording(false);
    setAudioLevel(0);
  };

  return (
    <div className="flex items-center space-x-2">
      {error && (
        <div className="text-red-500 text-sm mb-2">
          {error}
        </div>
      )}
      
      {!recording ? (
        <MainToolTip content="Start recording (Alt + H)">
          <button 
            onClick={startRecording}
            className="flex items-center"
          >
            <Mic className="mr-1 h-6 w-6" />
          </button>
        </MainToolTip>
      ) : (
        <div className="flex items-center space-x-2">
          {/* Recording indicator */}

          <MainToolTip content="Stop recording (Alt + H)">
            <button 
              onClick={stopRecording}
              className="flex items-center"
            >
              <Square className="mr-1 h-6 w-6 text-red-500" />
            </button>
          </MainToolTip>
        </div>
      )}
    </div>
  );
};