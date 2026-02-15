/* eslint-disable react/prop-types */
// import styles from "./Previews.module.scss";
import React from "react";
import { useState, useEffect, useRef } from "react";
import AdPlaceholder from "./AdPlaceholder";
import AdPreviewCard from "./AdPreviewCard";

export const AdPreview = (props) => {
  const { ad, gsdevtools, timestamp, maxFileSize = 150 } = props;

  const [isVisible, setIsVisible] = useState(false);

  // Ref for IntersectionObserver to determine visibility
  const containerRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // The banner became visible in the viewing area
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  if (!isVisible) return <AdPlaceholder ref={containerRef} width={ad.width} />;

  return <AdPreviewCard ad={ad} gsdevtools={gsdevtools} timestamp={timestamp} maxFileSize={maxFileSize} ref={containerRef} />;
};
