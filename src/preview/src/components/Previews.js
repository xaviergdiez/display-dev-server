/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import React from "react";
import styles from "./Previews.module.scss";
import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

import { ListSubheader, Tooltip, Box, Chip, FormControl, InputLabel, Button, Select, MenuItem, Typography, TablePagination, AppBar, Toolbar, OutlinedInput } from "@mui/material";
import CancelIcon from "@mui/icons-material/Cancel";
import CachedIcon from "@mui/icons-material/Cached";

import { AdPreview } from "./AdPreview";

const paginate = (array, page_size, page_number) => {
  return array.slice((page_number - 1) * page_size, page_number * page_size);
};

const getFiltersFromAds = (ads, searchParams) => {
  // returns array with all the filtergroup arrays containing all the unique filters
  // it also initially sets the filters based on the searchparams
  let filterGroups = [];
  ads.forEach((ad) => {
    const bundleSplits = ad.bundleName.split("_");

    bundleSplits.forEach((bundleSplit, index) => {
      if (!filterGroups[index]) filterGroups[index] = [];
      filterGroups[index].push(bundleSplit);
    });
  });

  filterGroups = filterGroups.map((filterGroup) => [...new Set(filterGroup)]); // make them all unique

  // get the initial filter(s) from the searchParams ?filter=hk,en;friendsfamily;160x600
  const searchParamsArray = searchParams.get("filter")
    ? searchParams
        .get("filter")
        .split(";")
        .map((filterGroup) => filterGroup.split(","))
    : [];

  return filterGroups.map((filterGroup) => {
    return filterGroup.map((filter) => {
      return {
        value: filter,
        selected: searchParamsArray.flat().includes(filter),
      };
    });
  });
};

const composeSearchParamsFromFilters = (filters) => {
  return filters
    .map((filterGroup) => {
      return filterGroup
        .filter((filter) => filter.selected)
        .map((filter) => filter.value)
        .join(",");
    })
    .filter((filterGroup) => filterGroup.length > 0)
    .join(";");
};

const getAdsListFromFilters = (adsList, filters) => {
  return adsList.filter((ad) => {
    // en_friendsfamily_ill_300x250
    return ad.bundleName.split("_").every((bundleSplit, index) => {
      const isFilteringOnGroup = filters[index].filter((filter) => filter.selected).length > 0; // if any of the 'selected' keys are true in these objects, it means we're filtering on that group.

      if (isFilteringOnGroup) {
        const [filterValue] = filters[index].filter((filter) => filter.value === bundleSplit).map((filter) => filter.selected);
        return filterValue;
      } else {
        return true; // if we're not filtering on this group, all keys in this group are allowed (because no specific filter is selected in that group)
      }
    });
  });
};

const getLabelFromFilterGroup = (filterGroup) => {
  if (filterGroup.every((filter) => filter.value.match(/[0-9]+x[0-9]+/i))) return "Dimensions"; // if it matches dimensions, like 300x500 ;
  if (filterGroup.every((filter) => filter.value.match(/^[a-z]{2}$/i))) return "Language"; // if string is 2 chars long and a-z or A-Z
  return "Category";
};

export default function Previews({ data }) {
  const [searchParams, setSearchParams] = useSearchParams();

  const [gsdevtools, setGSDevTools] = useState(searchParams.get("gsdevtools"));
  const isFirstRender = useRef(true);

  const [filters, setFilters] = useState(getFiltersFromAds(data.ads, searchParams));
  const [page, setPage] = useState(+searchParams.get("page") || 0);
  const [itemsPerPage, setItemsPerPage] = useState(+searchParams.get("perpage") || 10);

  const ads = useMemo(() => getAdsListFromFilters(data.ads, filters), [data.ads, filters]);

  useEffect(() => {
    const filter = decodeURI(composeSearchParamsFromFilters(filters));
    const collectFilters = {};
    filter && (collectFilters.filter = filter);
    gsdevtools && (collectFilters.gsdevtools = gsdevtools);
    page && (collectFilters.page = page);
    itemsPerPage && itemsPerPage != 10 && (collectFilters.perpage = itemsPerPage);

    // Check if the parameters have actually changed
    const currentParams = Object.fromEntries(searchParams.entries());
    const paramsChanged = JSON.stringify(currentParams) !== JSON.stringify(collectFilters);

    if (paramsChanged) {
      setSearchParams(collectFilters);
    }
  }, [filters, page, itemsPerPage, gsdevtools]);

  useEffect(() => {
    if (gsdevtools !== "true") return;
    const preventSpace = (e) => {
      if (e.defaultPrevented) return;
      if (e.key === " ") {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", preventSpace);
    return () => window.removeEventListener("keydown", preventSpace);
  }, []);

  const getSelectedFilters = () => {
    // returns flat array of selected filters i.e. ["en","300x400"] (the input element needs this as a value)
    return filters
      .flat()
      .filter((filter) => filter.selected)
      .map((filter) => filter.value);
  };

  const handleChangeFilter = (event) => {
    // make deep copy of filters state
    let updatedFilters = JSON.parse(JSON.stringify(filters));

    // set each filter's selected value based on the value from the event
    updatedFilters.flat().forEach((filter) => {
      filter.selected = event.target.value.includes(filter.value);
    });

    setFilters(updatedFilters);
    setPage(0);
  };

  function handleFilterDelete(e, value) {
    let updatedFilters = JSON.parse(JSON.stringify(filters));

    // set each filter's selected value based on the value from the event
    updatedFilters.flat().forEach((filter) => {
      if (filter.value === value) {
        filter.selected = false;
      }
    });

    setFilters(updatedFilters);
    setPage(0);
  }

  // handle button(s)

  const handleDownloadZips = (event) => {
    // console.log(event);
    window.open("all.zip");
  };

  const handleReloadDynamicData = async (e) => {
    const res = await fetch("reload_dynamic_data");
    if (res.status === 200) location.reload();
  };

  // handle pages
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setItemsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const pageAds = useMemo(() => {
    return paginate(ads, itemsPerPage, page + 1);
  }, [page, itemsPerPage, ads]);

  // toggle devtools
  useEffect(() => {
    let GSKeySequence = [];
    const keyDown = (event) => {
      GSKeySequence.push(event.key);
      if (GSKeySequence.includes("g") && GSKeySequence.includes("s")) {
        setGSDevTools((x) => !x);
      }
    };
    const keyUp = (event) => {
      GSKeySequence = GSKeySequence.filter((key) => key !== event.key);
    };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);

    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, []);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // This code will only run on subsequent changes to gsdevtools
    window.location.reload();
  }, [gsdevtools]);

  // generate page
  return (
    <>
      <AppBar position="sticky">
        <Toolbar className={styles.toolbar}>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            {data.isGoogleSpreadsheetBanner ? (
              <Tooltip title="Reload dynamic data" sx={{ marginRight: "10px" }}>
                <Button className="dynamic-reload" onClick={handleReloadDynamicData} color="inherit">
                  <CachedIcon />
                </Button>
              </Tooltip>
            ) : null}
            <Box className="logos" display="flex" gap="0px" alignItems="center">
              <img src="Monks-Logo_Small_White.png" />
              {data.client && (
                <Box display="flex" gap="10px" alignItems="center" sx={{ marginRight: "10px" }}>
                  <span>&times;</span>
                  <img src={data.client} />
                </Box>
              )}
            </Box>
            <Tooltip title={new Date(data.timestamp).toLocaleString()} sx={{ marginLeft: "10px" }}>
              <Typography align="left" variant="h5" component="div">
                Preview
              </Typography>
            </Tooltip>
          </Box>

          <FormControl sx={{ m: 1, minWidth: 150, maxWidth: "40%" }}>
            <InputLabel id="demo-multiple-chip-label">Filters</InputLabel>
            <Select
              labelId="demo-multiple-chip-label"
              id="demo-multiple-chip"
              multiple
              value={getSelectedFilters()}
              onChange={handleChangeFilter}
              input={<OutlinedInput id="select-multiple-chip" label="Filters" />}
              renderValue={(selected) => (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {selected.map((value) => (
                    <Chip onDelete={(e) => handleFilterDelete(e, value)} key={value} label={value} deleteIcon={<CancelIcon onMouseDown={(event) => event.stopPropagation()} />} />
                  ))}
                </Box>
              )}
            >
              {filters
                .filter((filterGroup) => filterGroup.length > 1) // only show filtergroups with more than 1 filter
                .map((filterGroup, filterGroupIndex) => [
                  <ListSubheader key={filterGroupIndex}>{getLabelFromFilterGroup(filterGroup)}</ListSubheader>,
                  filterGroup.map((filter, filterIndex) => (
                    <MenuItem key={filter.value} value={filter.value}>
                      {filter.value}
                    </MenuItem>
                  )),
                ])}
            </Select>
          </FormControl>
          <TablePagination labelRowsPerPage="Ads per page:" component="div" count={ads.length} page={ads.length ? page : 0} onPageChange={handleChangePage} rowsPerPage={itemsPerPage} onRowsPerPageChange={handleChangeRowsPerPage} />
          <Button onClick={handleDownloadZips} color="inherit">
            Download Zips
          </Button>
        </Toolbar>
      </AppBar>

      <div className={styles.previews}>
        {pageAds.length > 0 && pageAds.map((ad) => <AdPreview gsdevtools={gsdevtools} key={ad.bundleName} ad={ad} maxFileSize={ad.maxFileSize} timestamp={data.timestamp} />)}
        {pageAds.length < 1 && "No ads found with the current combination of filters"}
      </div>
    </>
  );
}
