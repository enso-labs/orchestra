import { Square } from "lucide-react";
import { Mic } from "lucide-react";
import React, { useState, useRef } from "react";
import apiClient from "../../lib/utils/apiClient";
import { useChatContext } from "../../context/ChatContext";

export const AudioRecorder: React.FC = () => {
  const { setPayload } = useChatContext();
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
        // formData.append("prompt", "Please transcribe the following audio: ");
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
          // handle transcription response...
        } catch (error) {
          console.error('Error uploading audio:', error);
          alert("Error uploading audio");
        }
      };

      recorder.start(1000);
      setRecording(true);
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
    setRecording(false);
  };

  return (
    <div>
      {error && (
        <div className="text-red-500 text-sm mb-2">
          {error}
        </div>
      )}
      {!recording ? (
        <button 
          onClick={startRecording}
          className="flex items-center"
        >
          <Mic className="mr-1 h-6 w-6" />
        </button>
      ) : (
        <button 
          onClick={stopRecording}
          className="flex items-center"
        >
          <Square className="mr-1 h-6 w-6" />
        </button>
      )}
    </div>
  );
};