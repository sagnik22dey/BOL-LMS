import React, { useState, useRef, useEffect } from 'react';
import ReactPlayer from 'react-player';
import { Box, Slider, IconButton, Typography, Tooltip } from '@mui/material';
import {
  PlayArrow, Pause, SkipPrevious, SkipNext, VolumeUp, VolumeOff,
  Fullscreen, FullscreenExit, Replay10, Forward10
} from '@mui/icons-material';

// ── Helpers ──────────────────────────────────────────────────────────────────

const getYouTubeVideoId = (url) => {
  if (!url) return '';
  if (url.includes('youtu.be/')) return url.split('youtu.be/')[1]?.split('?')[0] || '';
  if (url.includes('youtube.com/watch')) {
    try { return new URL(url).searchParams.get('v') || ''; }
    catch { return url.match(/[?&]v=([^&]+)/)?.[1] || ''; }
  }
  if (url.includes('youtube.com/embed/')) return url.split('youtube.com/embed/')[1]?.split('?')[0] || '';
  return '';
};

const getYouTubeEmbedUrl = (url) => {
  const videoId = getYouTubeVideoId(url);
  if (!videoId) return '';
  // youtube-nocookie.com avoids tracking cookies; controls=0 hides native UI
  const params = new URLSearchParams({
    enablejsapi:    '1',
    controls:       '0',   // hide native YouTube controls
    disablekb:      '1',   // disable keyboard shortcuts
    rel:            '0',   // no related videos
    modestbranding: '1',   // minimal branding
    iv_load_policy: '3',   // no annotations
    fs:             '0',   // disable native fullscreen button
    playsinline:    '1',
    origin:         window.location.origin,
  });
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
};

const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '00:00';
  const date = new Date(seconds * 1000);
  const hh = date.getUTCHours();
  const mm = date.getUTCMinutes();
  const ss = date.getUTCSeconds().toString().padStart(2, '0');
  if (hh) return `${hh}:${mm.toString().padStart(2, '0')}:${ss}`;
  return `${mm}:${ss}`;
};

// ── Component ─────────────────────────────────────────────────────────────────

const CustomVideoPlayer = ({ url, onNext, onPrev, hasNext, hasPrev, onEnded, isYouTube }) => {
  // ── Shared refs ────────────────────────────────────────────────────────────
  const containerRef    = useRef(null);
  const controlsTimeout = useRef(null);

  // ── Non-YouTube refs ───────────────────────────────────────────────────────
  const playerRef = useRef(null);

  // ── YouTube refs ───────────────────────────────────────────────────────────
  const ytIframeRef = useRef(null);

  // ── Shared UI state ────────────────────────────────────────────────────────
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ── Non-YouTube state ──────────────────────────────────────────────────────
  const [playing,  setPlaying]  = useState(false);
  const [volume,   setVolume]   = useState(0.8);
  const [muted,    setMuted]    = useState(false);
  const [played,   setPlayed]   = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking,  setSeeking]  = useState(false);

  // ── YouTube-specific state ─────────────────────────────────────────────────
  const [ytPlaying,     setYtPlaying]     = useState(false);
  const [ytCurrentTime, setYtCurrentTime] = useState(0);
  const [ytDuration,    setYtDuration]    = useState(0);
  const [ytVolume,      setYtVolume]      = useState(80);   // 0-100 scale
  const [ytMuted,       setYtMuted]       = useState(false);
  const [ytSeeking,     setYtSeeking]     = useState(false);

  // ── Fullscreen change listener (shared) ────────────────────────────────────
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // ── YouTube IFrame API message listener ────────────────────────────────────
  useEffect(() => {
    if (!isYouTube) return;

    const handleMessage = (event) => {
      if (!event.data) return;
      let data;
      try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; }
      catch { return; }

      if (data.event === 'onReady') {
        // Initialise volume after the player signals readiness
        sendYtCommand('setVolume', [80]);
      } else if (data.event === 'onStateChange') {
        // -1=unstarted, 0=ended, 1=playing, 2=paused, 3=buffering, 5=cued
        if (data.info === 1) {
          setYtPlaying(true);
          resetControlsTimeout();
        } else if (data.info === 2) {
          setYtPlaying(false);
          setShowControls(true);
        } else if (data.info === 0) {
          setYtPlaying(false);
          setShowControls(true);
          onEnded?.();
        }
      } else if (data.event === 'infoDelivery' && data.info) {
        // YouTube pushes currentTime/duration updates here while playing
        if (!ytSeeking) {
          if (data.info.currentTime !== undefined) setYtCurrentTime(data.info.currentTime);
          if (data.info.duration    !== undefined && data.info.duration > 0)
            setYtDuration(data.info.duration);
        }
        if (data.info.volume  !== undefined) setYtVolume(data.info.volume);
        if (data.info.muted   !== undefined) setYtMuted(data.info.muted);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isYouTube, ytSeeking, onEnded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── YouTube postMessage helper ─────────────────────────────────────────────
  const sendYtCommand = (func, args = []) => {
    ytIframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func, args }),
      '*'
    );
  };

  // Start listening for YouTube messages once iframe is loaded
  const handleYtLoad = () => {
    ytIframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'listening', id: 1 }),
      '*'
    );
  };

  // ── Shared controls helpers ────────────────────────────────────────────────
  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => setShowControls(false), 3000);
  };

  // ── Touch handler – show controls on tap ──────────────────────────────────
  const handleTouchStart = () => {
    resetControlsTimeout();
  };

  const toggleFullscreen = (e) => {
    e?.stopPropagation();
    if (!isFullscreen) containerRef.current?.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  // ── YouTube-specific control handlers ─────────────────────────────────────
  const handleYtPlayPause = (e) => {
    e?.stopPropagation();
    e?.preventDefault();
    resetControlsTimeout();
    if (ytPlaying) { sendYtCommand('pauseVideo'); setYtPlaying(false); }
    else           { sendYtCommand('playVideo');  setYtPlaying(true);  }
  };

  const handleYtSeekMouseDown = () => setYtSeeking(true);

  const handleYtSeekChange = (_e, val) => setYtCurrentTime(val);

  const handleYtSeekMouseUp = (_e, val) => {
    setYtSeeking(false);
    sendYtCommand('seekTo', [val, true]);
  };

  const handleYtVolumeChange = (_e, val) => {
    setYtVolume(val);
    sendYtCommand('setVolume', [val]);
    if (val === 0) { sendYtCommand('mute');   setYtMuted(true);  }
    else           { sendYtCommand('unMute'); setYtMuted(false); }
  };

  const handleYtToggleMute = (e) => {
    e.stopPropagation();
    if (ytMuted) { sendYtCommand('unMute'); setYtMuted(false); }
    else         { sendYtCommand('mute');   setYtMuted(true);  }
  };

  const handleYtRewind = (e) => {
    e.stopPropagation();
    const t = Math.max(0, ytCurrentTime - 10);
    setYtCurrentTime(t);
    sendYtCommand('seekTo', [t, true]);
  };

  const handleYtFastForward = (e) => {
    e.stopPropagation();
    const t = Math.min(ytDuration || Infinity, ytCurrentTime + 10);
    setYtCurrentTime(t);
    sendYtCommand('seekTo', [t, true]);
  };

  // ── Non-YouTube control handlers ───────────────────────────────────────────
  const handlePlayPause = (e) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    setPlaying((p) => !p);
  };
  const handleProgress = (state) => { if (!seeking) setPlayed(state.played); };
  const handleSeekChange = (_e, val) => setPlayed(val);
  const handleSeekMouseDown = () => setSeeking(true);
  const handleSeekMouseUp = (_e, val) => {
    setSeeking(false);
    playerRef.current?.seekTo(val);
  };
  const handleRewind = (e) => {
    e.stopPropagation();
    const t = (playerRef.current?.getCurrentTime?.() ?? played * duration) - 10;
    playerRef.current?.seekTo(t);
  };
  const handleFastForward = (e) => {
    e.stopPropagation();
    const t = (playerRef.current?.getCurrentTime?.() ?? played * duration) + 10;
    playerRef.current?.seekTo(t);
  };
  const toggleMute = (e) => { e.stopPropagation(); setMuted((m) => !m); };
  const handleVolumeChange = (_e, val) => { setVolume(val); setMuted(val === 0); };

  // ── Shared slider styles ───────────────────────────────────────────────────
  const seekSliderSx = {
    color: '#1da1f2',
    mb: 1,
    '& .MuiSlider-thumb': {
      width: 12, height: 12,
      '&:hover, &.Mui-focusVisible, &.Mui-active': { boxShadow: 'none', width: 16, height: 16 },
    },
    '& .MuiSlider-track': { border: 'none' },
    '& .MuiSlider-rail':  { opacity: 0.3, backgroundColor: '#fff' },
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ── YouTube branch ────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  if (isYouTube) {
    const embedUrl = getYouTubeEmbedUrl(url);

    return (
      <Box
        ref={containerRef}
        onMouseMove={resetControlsTimeout}
        onMouseLeave={() => setShowControls(false)}
        onTouchStart={handleTouchStart}
        sx={{
          position: 'relative',
          width: '100%',
          height: '100%',
          backgroundColor: '#000',
          overflow: 'hidden',
          userSelect: 'none',
        }}
      >
        {/* ── YouTube iframe (no native controls, nocookie domain) ── */}
        <iframe
          ref={ytIframeRef}
          src={embedUrl}
          title="Video player"
          width="100%"
          height="100%"
          style={{ border: 'none', display: 'block', pointerEvents: 'none' }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
          onLoad={handleYtLoad}
        />

        {/*
          ── Transparent overlay ──
          Covers the entire iframe so the user can never:
            • Click the YouTube logo
            • See / click "Watch on YouTube"
            • Access the "More videos" end-screen
          The overlay captures clicks for play/pause.
          The controls bar sits above it (zIndex 20 > 10).
        */}
        <Box
          onClick={handleYtPlayPause}
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            cursor: 'pointer',
            // Keep a gap at the bottom so the controls bar receives its own events
            bottom: showControls ? 72 : 0,
          }}
        />

        {/* ── Custom control bar ── */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)',
            px: 2, pb: 1, pt: 5,
            opacity: showControls ? 1 : 0,
            transition: 'opacity 0.3s ease',
            zIndex: 20,
          }}
        >
          {/* Seek slider */}
          <Slider
            min={0}
            max={ytDuration || 100}
            step={0.5}
            value={ytCurrentTime}
            onMouseDown={handleYtSeekMouseDown}
            onChange={handleYtSeekChange}
            onChangeCommitted={handleYtSeekMouseUp}
            sx={seekSliderSx}
          />

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {hasPrev && (
                <Tooltip title="Previous Lesson">
                  <IconButton onClick={onPrev} size="small" sx={{ color: 'white' }}>
                    <SkipPrevious fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}

              <Tooltip title={ytPlaying ? 'Pause' : 'Play'}>
                <IconButton onClick={handleYtPlayPause} size="small" sx={{ color: 'white' }}>
                  {ytPlaying ? <Pause /> : <PlayArrow />}
                </IconButton>
              </Tooltip>

              {hasNext && (
                <Tooltip title="Next Lesson">
                  <IconButton onClick={onNext} size="small" sx={{ color: 'white' }}>
                    <SkipNext fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}

              <Tooltip title="Rewind 10s">
                <IconButton onClick={handleYtRewind} size="small" sx={{ color: 'white' }}>
                  <Replay10 fontSize="small" />
                </IconButton>
              </Tooltip>

              <Tooltip title="Forward 10s">
                <IconButton onClick={handleYtFastForward} size="small" sx={{ color: 'white' }}>
                  <Forward10 fontSize="small" />
                </IconButton>
              </Tooltip>

              {/* Volume */}
              <Box sx={{ display: 'flex', alignItems: 'center', width: 100, ml: 1 }}>
                <IconButton onClick={handleYtToggleMute} size="small" sx={{ color: 'white' }}>
                  {ytMuted || ytVolume === 0
                    ? <VolumeOff fontSize="small" />
                    : <VolumeUp  fontSize="small" />
                  }
                </IconButton>
                <Slider
                  min={0} max={100} step={5}
                  value={ytMuted ? 0 : ytVolume}
                  onChange={handleYtVolumeChange}
                  sx={{ color: 'white', '& .MuiSlider-thumb': { width: 10, height: 10 } }}
                />
              </Box>

              <Typography variant="caption" sx={{ color: 'white', ml: 2, fontFamily: 'monospace' }}>
                {formatTime(ytCurrentTime)} / {formatTime(ytDuration)}
              </Typography>
            </Box>

            <Box>
              <Tooltip title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
                <IconButton onClick={toggleFullscreen} size="small" sx={{ color: 'white' }}>
                  {isFullscreen ? <FullscreenExit fontSize="small" /> : <Fullscreen fontSize="small" />}
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Box>
      </Box>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── Non-YouTube branch (ReactPlayer with full controls) ───────────────────
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <Box
      ref={containerRef}
      onMouseMove={resetControlsTimeout}
      onMouseLeave={() => playing && setShowControls(false)}
      onTouchStart={handleTouchStart}
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <ReactPlayer
        ref={playerRef}
        url={url}
        width="100%"
        height="100%"
        playing={playing}
        volume={volume}
        muted={muted}
        onProgress={handleProgress}
        onDuration={(d) => setDuration(d)}
        onEnded={onEnded}
        config={{
          file: { attributes: { controlsList: 'nodownload' } },
        }}
      />

      {/* Invisible overlay – play/pause on click */}
      <Box
        onClick={handlePlayPause}
        sx={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          bottom: showControls ? 60 : 0,
          cursor: 'pointer',
          zIndex: 10,
        }}
      />

      {/* Control Bar */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)',
          px: 2, pb: 1, pt: 4,
          opacity: showControls ? 1 : 0,
          transition: 'opacity 0.3s ease',
          zIndex: 20,
        }}
      >
        <Slider
          min={0} max={1} step={0.001}
          value={played}
          onMouseDown={handleSeekMouseDown}
          onChange={handleSeekChange}
          onChangeCommitted={handleSeekMouseUp}
          sx={seekSliderSx}
        />

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {hasPrev && (
              <Tooltip title="Previous Lesson">
                <IconButton onClick={onPrev} size="small" sx={{ color: 'white' }}>
                  <SkipPrevious fontSize="small" />
                </IconButton>
              </Tooltip>
            )}

            <Tooltip title={playing ? 'Pause' : 'Play'}>
              <IconButton onClick={handlePlayPause} size="small" sx={{ color: 'white' }}>
                {playing ? <Pause /> : <PlayArrow />}
              </IconButton>
            </Tooltip>

            {hasNext && (
              <Tooltip title="Next Lesson">
                <IconButton onClick={onNext} size="small" sx={{ color: 'white' }}>
                  <SkipNext fontSize="small" />
                </IconButton>
              </Tooltip>
            )}

            <Tooltip title="Rewind 10s">
              <IconButton onClick={handleRewind} size="small" sx={{ color: 'white' }}>
                <Replay10 fontSize="small" />
              </IconButton>
            </Tooltip>

            <Tooltip title="Forward 10s">
              <IconButton onClick={handleFastForward} size="small" sx={{ color: 'white' }}>
                <Forward10 fontSize="small" />
              </IconButton>
            </Tooltip>

            <Box sx={{ display: 'flex', alignItems: 'center', width: 100, ml: 1 }}>
              <IconButton onClick={toggleMute} size="small" sx={{ color: 'white' }}>
                {muted || volume === 0 ? <VolumeOff fontSize="small" /> : <VolumeUp fontSize="small" />}
              </IconButton>
              <Slider
                min={0} max={1} step={0.05}
                value={muted ? 0 : volume}
                onChange={handleVolumeChange}
                sx={{ color: 'white', '& .MuiSlider-thumb': { width: 10, height: 10 } }}
              />
            </Box>

            <Typography variant="caption" sx={{ color: 'white', ml: 2, fontFamily: 'monospace' }}>
              {formatTime(played * duration)} / {formatTime(duration)}
            </Typography>
          </Box>

          <Box>
            <Tooltip title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
              <IconButton onClick={toggleFullscreen} size="small" sx={{ color: 'white' }}>
                {isFullscreen ? <FullscreenExit fontSize="small" /> : <Fullscreen fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default CustomVideoPlayer;
