import { useState, useEffect, useRef } from "react";
import "./CustomVideoPlayer.css";

const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
};

export default function CustomVideoPlayer({ src, className = "" }) {
    const wrapperRef = useRef(null);
    const videoRef = useRef(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState("0:00");
    const [duration, setDuration] = useState("0:00");
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.volume = volume;
            videoRef.current.muted = isMuted;
        }
    }, [volume, isMuted]);

    const togglePlay = (e) => {
        if (e) e.stopPropagation();
        if (!videoRef.current) return;

        if (videoRef.current.paused) {
            const playPromise = videoRef.current.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    setIsPlaying(true);
                }).catch(error => {
                    // Sadece AbortError (bileşen kapanması) dışındaki GEREKLİ hataları logla
                    if (error.name !== "AbortError" && error.name !== "NotSupportedError") {
                        console.warn("Video oynatılamadı:", error.message);
                    }
                    setIsPlaying(false);
                });
            }
        } else {
            videoRef.current.pause();
            setIsPlaying(false);
        }
    };

    const toggleMute = (e) => { e.stopPropagation(); setIsMuted(!isMuted); };

    const handleVolumeChange = (e) => {
        e.stopPropagation();
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        setIsMuted(newVolume === 0);
        if (videoRef.current) {
            videoRef.current.volume = newVolume;
            videoRef.current.muted = newVolume === 0;
        }
    };

    const handleTimeUpdate = () => {
        if (!videoRef.current) return;
        const current = videoRef.current.currentTime;
        const dur = videoRef.current.duration;
        if (dur > 0) setProgress((current / dur) * 100);
        setCurrentTime(formatDuration(current));
    };

    const handleLoadedData = () => {
        if (!videoRef.current) return;
        setDuration(formatDuration(videoRef.current.duration));

        if (videoRef.current.autoplay) {
            const playPromise = videoRef.current.play();
            if (playPromise !== undefined) {
                playPromise.then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
            }
        }
    };

    const handleProgressClick = (e) => {
        e.stopPropagation();
        if (!videoRef.current) return;
        const bar = e.currentTarget;
        const clickPos = (e.pageX - bar.getBoundingClientRect().left) / bar.offsetWidth;
        videoRef.current.currentTime = clickPos * videoRef.current.duration;
    };

    const toggleFullscreen = async (e) => {
        e.stopPropagation();
        if (!document.fullscreenElement) {
            if (wrapperRef.current.requestFullscreen) await wrapperRef.current.requestFullscreen();
            else if (wrapperRef.current.webkitRequestFullscreen) await wrapperRef.current.webkitRequestFullscreen();
        } else {
            if (document.exitFullscreen) await document.exitFullscreen();
            else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
        }
    };

    return (
        <div ref={wrapperRef} className={`custom-video-wrapper ${className}`} onClick={togglePlay}>
            <video
                ref={videoRef}
                src={src || ""}
                className="custom-video"
                onTimeUpdate={handleTimeUpdate}
                onLoadedData={handleLoadedData}
                onEnded={() => setIsPlaying(false)}
                playsInline
                preload="metadata" /* Firebase videolarının daha düzgün yüklenmesi için eklendi */
                /* crossOrigin="anonymous" etiketi CORS hatasını çözmek için KALDIRILDI */
            />
            {!isPlaying && (
                <div className="video-overlay-play">
                    <i className="fa-solid fa-play"></i>
                </div>
            )}

            <div className="custom-video-controls" onClick={(e) => e.stopPropagation()}>
                <button onClick={togglePlay}>
                    <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
                </button>

                <div className="video-volume-container">
                    <button onClick={toggleMute} className="volume-btn">
                        <i className={`fa-solid ${isMuted || volume === 0 ? 'fa-volume-xmark' : volume < 0.5 ? 'fa-volume-low' : 'fa-volume-high'}`}></i>
                    </button>
                    <div className="video-volume-slider">
                        <input
                            type="range"
                            min="0" max="1" step="0.05"
                            value={isMuted ? 0 : volume}
                            onChange={handleVolumeChange}
                            className="volume-range"
                        />
                    </div>
                </div>

                <span className="video-time" style={{marginLeft: "auto"}}>{currentTime}</span>
                <div className="video-progress-bar" onClick={handleProgressClick}>
                    <div className="video-progress-fill" style={{ width: `${progress}%` }}></div>
                </div>
                <span className="video-time">{duration}</span>

                <button onClick={toggleFullscreen} title={isFullscreen ? "Küçült" : "Tam Ekran"} style={{ marginLeft: "5px" }}>
                    <i className={`fa-solid ${isFullscreen ? 'fa-compress' : 'fa-expand'}`}></i>
                </button>
            </div>
        </div>
    );
}