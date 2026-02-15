/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import React, { useState, useEffect, useRef, forwardRef, useMemo } from "react";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardMedia from "@mui/material/CardMedia";
import Typography from "@mui/material/Typography";

import Chip from "@mui/material/Chip";
import Tab from "@mui/material/Tab";
import Tooltip from "@mui/material/Tooltip";
import Divider from "@mui/material/Divider";
import CardContent from "@mui/material/CardContent";
import IconButton from "@mui/material/IconButton";
import TabContext from "@mui/lab/TabContext";
import TabList from "@mui/lab/TabList";

import ReplayIcon from "@mui/icons-material/Replay";
import GifIcon from "@mui/icons-material/Gif";
import ImageIcon from "@mui/icons-material/Image";
import MovieIcon from "@mui/icons-material/Movie";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import FolderZipIcon from "@mui/icons-material/FolderZip";
import FolderIcon from "@mui/icons-material/FolderOpen";
import Quality from "@mui/icons-material/CameraEnhance";
import InfoIcon from "@mui/icons-material/Info";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import PauseCircleIcon from "@mui/icons-material/PauseCircle";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import Forward5Icon from "@mui/icons-material/Forward5";
import AnimationTimer from "./AnimationTimer";

const AdPreviewCard = forwardRef((props, ref) => {
  const { ad, gsdevtools, timestamp, maxFileSize } = props;

  const [paused, setPaused] = useState(false);
  // const [animationForPauseCurrentTime, setAnimationForPauseCurrentTime] = useState(0);
  const [animationForPauseDuration, setAnimationForPauseDuration] = useState(0);
  const [animationForPause, setAnimationForPause] = useState(null);

  const cachedHTML = ad.output.html ? `${ad.output.html.url}?r=${timestamp}` : "";

  const extensionTypes = ["jpg,img", "mp4,video", "gif,img"];
  const extensionIcons = useMemo(
    () => ({
      html: "",
      zip: <FolderZipIcon />,
      jpg: <ImageIcon />,
      mp4: <MovieIcon />,
      gif: <GifIcon />,
    }),
    []
  );

  const initialMediaType = useMemo(() => {
    return ad.output.html
      ? "iframe"
      : extensionTypes
          .find((tab) => {
            const [type, tag] = tab.split(",");
            return Object.keys(ad.output).includes(type);
          })
          .split(",")[1];
  }, [ad.output]);

  const [mediaType, setMediaType] = useState(initialMediaType);
  const [mediaSource, setMediaSource] = useState(cachedHTML);

  const initialActiveConfigTab = useMemo(() => {
    return ad.output.html
      ? "html,iframe"
      : extensionTypes.find((tab) => {
          const [type, tag] = tab.split(",");
          return Object.keys(ad.output).includes(type);
        });
  }, [ad.output]);

  const [activeConfigTab, setActiveConfigTab] = useState(initialActiveConfigTab);

  const [animation, setAnimation] = useState(null);

  const adPreviewCard = useRef();

  const gsDevContainer = useRef();

  useEffect(() => {
    if (!adPreviewCard.current) return;
    if (gsdevtools == "true") gsDevContainer.current && (gsDevContainer.current.innerHTML = "");
    const ifr = adPreviewCard.current;
    let cleanup = null;

    ifr.onload = () => {
      if (!ifr.contentWindow) return;

      const setAnim = (e) => (gsdevtools === "true" ? setAnimation(e.detail) : setAnimationForPause(e.detail));

      ifr.contentWindow.addEventListener("getMainTimeline", setAnim);
      ifr.contentWindow.dispatchEvent(new CustomEvent("previewReady"));

      cleanup = () => {
        // Safe cleanup that checks if references are still valid
        if (ifr && ifr.contentWindow) {
          ifr.contentWindow.removeEventListener("getMainTimeline", setAnim);
        }
      };
    };

    // Proper cleanup function that React can use
    return () => {
      if (cleanup) cleanup();
    };
  }, [mediaSource, gsdevtools]);

  // create devtools box with animation
  useEffect(() => {
    if (!animation) return;

    animation.pause(0);
    // eslint-disable-next-line no-undef
    const tl = gsap.timeline();
    // eslint-disable-next-line no-undef
    tl.to(animation, { duration: animation.totalDuration(), totalProgress: 1, ease: Linear.easeNone });
    gsDevContainer.current && (gsDevContainer.current.innerHTML = "");
    // eslint-disable-next-line no-undef
    GSDevTools.create({
      container: gsDevContainer.current,
      animation: tl,
      visibility: "visible",
      globalSync: false,
    });
  }, [animation]);

  useEffect(() => {
    const [type, mediaType] = activeConfigTab.split(",");
    setMediaType(mediaType);

    if (type === "html") {
      setMediaSource(cachedHTML);
    } else {
      setMediaSource(ad.output[type].url);
    }
  }, [activeConfigTab]);

  function reload() {
    if (!adPreviewCard.current) return;
    activeConfigTab === "html,iframe"
      ? (adPreviewCard.current.src = cachedHTML)
      : setActiveConfigTab(
          ad.output.html
            ? "html,iframe"
            : extensionTypes.find((tab) => {
                const [type, tag] = tab.split(",");
                return Object.keys(ad.output).includes(type);
              })
        );
    setPaused(false);
    // setAnimationForPauseCurrentTime(0);
    setAnimationForPause(undefined);
    setAnimation(undefined);
  }

  // seek 250ms
  function seek() {
    if (!animationForPause) return;
    setPaused(true);
    animationForPause.seek(animationForPause.time() + 0.25, false);
  }

  useEffect(() => {
    let lastTriggered = 0;
    const throttleDelay = 50;

    const handleKeyDown = (event) => {
      const now = Date.now();
      // Skip the event if not enough time has passed
      if (now - lastTriggered < throttleDelay) return;
      lastTriggered = now;

      // Centralized processing of all hotkeys
      switch (event.key) {
        case "r":
          reload();
          break;
        case "ArrowRight":
          if (animationForPause) animationForPause.progress(1);
          break;
        case ".":
          if (animationForPause) seek();
          break;
        case " ":
          if (gsdevtools !== "true") {
            event.preventDefault();
            setPaused((prev) => !prev);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [animationForPause, reload, seek, gsdevtools, setPaused]);

  useEffect(() => {
    if (!animationForPause) return;

    setAnimationForPauseDuration(animationForPause.duration());

    const onComplete = animationForPause.eventCallback("onComplete");

    animationForPause.eventCallback("onComplete", () => {
      onComplete && onComplete();
      setPaused(true);
    });
  }, [animationForPause]);

  useEffect(() => {
    if (!animationForPause) return;

    if (paused) animationForPause.pause();
    else {
      if (animationForPause.progress() == 1) {
        reload();
      } else {
        animationForPause.play();
      }
    }
  }, [paused, animationForPause]);

  return (
    <Card
      ref={ref}
      sx={{
        minWidth: `${ad.width}px`,
        maxWidth: `${ad.width}px`,
        height: "fit-content",
      }}
      className="card"
    >
      <Typography sx={{ padding: "0px 10px", margin: "10px 0", wordBreak: "break-all" }} align="center" variant="body2">
        {ad.bundleName}
      </Typography>
      <TabContext value={activeConfigTab}>
        <Box sx={{ borderColor: "divider" }}>
          <TabList
            variant="fullWidth"
            onChange={(event, newValue) => setActiveConfigTab(newValue)}
            TabIndicatorProps={
              extensionTypes.filter((item) => {
                const [extension, type] = item.split(",");
                return ad.output[extension];
              }).length +
                (ad.output.html ? 1 : 0) >
              1 // hide blue line if only 1 tab
                ? {}
                : { style: { display: "none" } }
            }
          >
            {ad.output.html ? <Tab wrapped sx={{ minWidth: "50px" }} label="html" value="html,iframe" /> : ""}
            {extensionTypes.map((item) => {
              const [extension, type] = item.split(",");
              if (ad.output[extension]) return <Tab key={item} disabled={!ad.output[extension]?.url} icon={extensionIcons[extension]} sx={{ minWidth: "50px" }} value={item} />;
            })}
          </TabList>
        </Box>
      </TabContext>

      <CardMedia
        ref={adPreviewCard}
        component={mediaType}
        scrolling="no"
        style={{
          width: ad.width,
          height: ad.height,
          transform: "translateZ(0)", // Activates hardware acceleration?
          backfaceVisibility: "hidden",
          perspective: 1000,
        }}
        height={ad.height}
        width={ad.width}
        src={mediaSource}
        id={ad.bundleName}
        className={ad.bundleName}
        frameBorder="0"
        autoPlay
        controls
      />

      <CardContent>
        {gsdevtools === "true" && animation !== null && activeConfigTab.split(",")[0] === "html" ? (
          <>
            <Box ref={gsDevContainer}></Box>
            <Divider light sx={{ margin: "20px 0" }} />
          </>
        ) : null}
        {gsdevtools !== "true" && animationForPause !== null && activeConfigTab === "html,iframe" && !ad.controlsOff ? (
          <>
            <Box marginBottom="20px" display="flex" flexWrap="wrap" gap="10px" justifyContent="space-between" alignItems="center" className="controls">
              <Box>
                <Tooltip title="▶／❚❚">
                  <IconButton
                    onClick={() => {
                      setPaused(!paused);
                    }}
                    color="primary"
                  >
                    {paused ? <PlayCircleIcon /> : <PauseCircleIcon />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Seek to the end">
                  <IconButton
                    onClick={() => {
                      animationForPause?.progress(1);
                    }}
                    color="primary"
                  >
                    <SkipNextIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Seek 250ms">
                  <IconButton onClick={() => seek()} color="primary">
                    <Forward5Icon />
                  </IconButton>
                </Tooltip>
              </Box>
              <AnimationTimer animation={animationForPause} duration={animationForPauseDuration} />
            </Box>
            <Divider light sx={{ margin: "20px 0" }} />
          </>
        ) : null}
        {["zip", "unzip", "jpg", "mp4", "gif"].some((ext) => ad.output && ad.output[ext] && ad.output[ext].size) || ad.quality ? (
          <>
            <Box marginBottom="20px" display="flex" flexWrap="wrap" gap="10px" justifyContent="space-evenly" className="chips">
              {ad.output?.zip?.size ? (
                <Tooltip title={`Compressed size: ${(ad.output.zip.size / 1024).toFixed(1)} KB`}>
                  <Chip icon={<FolderZipIcon />} label={`${Math.floor(ad.output.zip.size / 1024)} KB`} color={ad.output.zip.size / 1024 <= maxFileSize ? "success" : "error"} />
                </Tooltip>
              ) : null}
              {ad.output?.unzip?.size ? (
                <Tooltip title={`Uncompressed size: ${(ad.output.unzip.size / 1024).toFixed(1)} KB`}>
                  <Chip icon={<FolderIcon />} label={`${Math.floor(ad.output.unzip.size / 1024)} KB`} color={ad.output.unzip.size / 1024 <= maxFileSize ? "success" : "error"} />
                </Tooltip>
              ) : null}
              {["jpg", "mp4", "gif"].map((ext) => {
                if (ad.output[ext] && ad.output[ext].size) {
                  return (
                    <Tooltip key={ext} title={`${ext.toUpperCase()} size: ${(ad.output[ext].size / 1024).toFixed(1)} KB`}>
                      <Chip icon={extensionIcons[ext]} label={`${Math.floor(ad.output[ext].size / 1024)} KB`} color={ad.output[ext].size / 1024 <= maxFileSize ? "success" : "error"} />
                    </Tooltip>
                  );
                }
                return "";
              })}
              {ad.quality && gsdevtools === "true" ? (
                <Tooltip title="Asset quality" className="quality">
                  <Chip icon={<Quality />} label={`${ad.quality}`} color={ad.quality > 85 ? "success" : ad.quality > 70 ? "warning" : "error"} />
                </Tooltip>
              ) : null}
            </Box>
            <Divider light sx={{ margin: "20px 0" }} />
          </>
        ) : null}
        {gsdevtools === "true" && ad.info ? (
          <>
            <Box marginBottom="20px" display="flex" flexWrap="wrap" gap="10px" justifyContent="flex-start" className="chips">
              {Object.entries(ad.info).map(([name, value]) => {
                return (
                  <Tooltip title={name} key={name}>
                    <Chip icon={<InfoIcon />} label={value} color={"info"} />
                  </Tooltip>
                );
              })}
            </Box>
            <Divider light sx={{ margin: "20px 0" }} />
          </>
        ) : null}
        <Box display="flex" flexWrap="wrap" justifyContent="space-between">
          <Box>
            {ad.output.html ? (
              <>
                <Tooltip title="Reload">
                  <IconButton
                    onClick={() => {
                      reload();
                    }}
                    color="primary"
                  >
                    <ReplayIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Open in new window">
                  <IconButton onClick={() => window.open(ad.output.html.url)} color="primary">
                    <OpenInNewIcon />
                  </IconButton>
                </Tooltip>
              </>
            ) : null}
          </Box>
          <Box>
            <Box display="flex" flexWrap="wrap">
              {Object.keys(ad.output).map((extension) => {
                if (ad.output[extension] && ad.output[extension].url && extension != "html")
                  return (
                    <Tooltip key={extension} title={`Download ${extension.toUpperCase()} ${!ad.output[extension]?.url ? "(loading)" : ""}`}>
                      <span>
                        <IconButton disabled={!ad.output[extension]?.url} onClick={(e) => (window.location.href = ad.output[extension]?.url)} color="primary">
                          {extensionIcons[extension]}
                        </IconButton>
                      </span>
                    </Tooltip>
                  );
              })}
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
});

AdPreviewCard.displayName = "AdPreviewCard";

export default AdPreviewCard;
