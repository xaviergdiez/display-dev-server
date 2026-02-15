/* eslint-disable react/prop-types */
import React, { useState, useEffect, useRef } from "react";
import Typography from "@mui/material/Typography";

const AnimationTimer = ({ animation, duration }) => {
  const [currentTime, setCurrentTime] = useState(0);
  const lastUpdateTimeRef = useRef(0);
  const requestRef = useRef();

  useEffect(() => {
    if (!animation) {
      // Reset timer when animation is removed/reset
      setCurrentTime(0);
      return;
    }

    // Set initial duration and time
    setCurrentTime(animation.time());

    // Our throttled update function
    const updateTimeDisplay = () => {
      const now = performance.now();
      if (now - lastUpdateTimeRef.current > 50) {
        const time = animation.time();
        // Update at most 20 times per second
        setCurrentTime(animation.time());
        lastUpdateTimeRef.current = now;

        // Checking the end of the animation
        if (time >= duration && duration > 0) {
          return; // Stops the loop without requesting the next frame
        }
      }

      requestRef.current = requestAnimationFrame(updateTimeDisplay);
    };

    // Start the animation frame loop
    requestRef.current = requestAnimationFrame(updateTimeDisplay);

    return () => {
      cancelAnimationFrame(requestRef.current);
    };
  }, [animation]);

  return (
    <Typography>
      {currentTime.toFixed(2)} / {duration.toFixed(2)}s
    </Typography>
  );
};

export default React.memo(AnimationTimer);
