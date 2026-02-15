/* eslint-disable react/prop-types */
import React from "react";
import Card from "@mui/material/Card";

const AdPlaceholder = React.forwardRef((props, ref) => {
  const { width } = props;
  return (
    <Card
      ref={ref}
      sx={{
        minWidth: `${width}px`,
        maxWidth: `${width}px`,
        height: "fit-content",
      }}
      className="card"
    />
  );
});

AdPlaceholder.displayName = "AdPlaceholder";

export default AdPlaceholder;
