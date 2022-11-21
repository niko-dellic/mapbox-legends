// import our local data about philadelphia population by census tract
import phillyCensus from "./data/PhillyPopulation.geojson" assert { type: "json" };

// calculate population density: total pop/area
phillyCensus.features.forEach((d) => {
  d.properties["POP_DENSITY"] =
    d.properties.COUNT_ALL_RACES_ETHNICITIES / d.properties.AreaKM;
});

//   filter out the entries whose population density is less than 100 inhabitants per square kilometer
phillyCensus.features = phillyCensus.features.filter((d) => {
  return d.properties.POP_DENSITY > 100;
});

// starting map creation
mapboxgl.accessToken =
  "pk.eyJ1Ijoibmlrby1kZWxsaWMiLCJhIjoiY2w5c3p5bGx1MDh2eTNvcnVhdG0wYWxkMCJ9.4uQZqVYvQ51iZ64yG8oong";
const map = new mapboxgl.Map({
  container: "map", // Container ID
  style: "mapbox://styles/niko-dellic/cl9t226as000x14pr1hgle9az", // Map style to use
  projection: "globe",
  //   center on philadelphia
  center: [-75.0638, 39.9926],
  zoom: 10.75,
});

// stylize the globe effect
map.on("style.load", () => {
  map.setFog({
    range: [1, 7],
    color: "#d6fffc",
    "horizon-blend": 0.03,
    "high-color": "#000000",
    "space-color": "#000000",
    "star-intensity": 0,
  });
});

// once the basemap is loaded, begin to add data sources and layers
map.on("load", () => {
  //   add source for philly data
  map.addSource("phillyPop", {
    type: "geojson",
    data: phillyCensus,
  });

  const scaleType = {
    equal: "equalInterval",
    quantile: "quantile",
  };

  //   create the color value scale for the data
  const scale = getMapScale(phillyCensus, "POP_DENSITY", scaleType.quantile);

  // add layer for philly data
  map.addLayer({
    id: "phillyPop",
    type: "fill",
    source: "phillyPop", // reference the data source
    layout: {},
    paint: {
      // style the layer based on POP_DENSITY property
      "fill-color": [
        "interpolate",
        ["linear"],
        ["get", "POP_DENSITY"],
        // use our quantile scale function that we created above to automatically generate the color scale
        ...scale[0],
      ],
      //   change opacity based on zoom level
      "fill-opacity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        7, //zoom level
        0, //opacity
        9, //zoom level
        0.8, //opacity
        12, //zoom level
        0.5, //opacity
        13, //zoom level
        0, //opacity
      ],
    },
  });

  // get the data from the landuse layer
  const landuseData = map.querySourceFeatures("composite", {
    sourceLayer: "landuse",
  });

  const landuseTypes = [...new Set(landuseData.map((d) => d.properties.class))];

  const landuseColors = [
    ["park", "MediumSpringGreen"],
    ["school", "Plum"],
    ["hospital", "OrangeRed"],
    ["industrial", "RosyBrown"],
    ["rgba(0,0,0,0)"], //for all other categories, set the color to transparent
  ];

  // set the fill color of the landuse layer to based on the category
  map.setPaintProperty("land-use", "fill-color", [
    "match",
    ["get", "class"],
    ...landuseColors.flat(),
  ]);

  // change the fill opacity of the landuse layer to 0.5
  map.setPaintProperty("land-use", "fill-opacity", 0.5);

  //   create a landuse legend
  const landuseLegend = document.createElement("div");
  landuseLegend.className = "map-overlay";
  landuseLegend.id = "landuse-legend";

  //   create a legend title
  const landuseLegendTitle = document.createElement("h3");
  landuseLegendTitle.innerHTML = "Landuse";
  landuseLegend.appendChild(landuseLegendTitle);

  //   create a legend container
  const landuseLegendContainer = document.createElement("div");

  //   create a legend item for each landuse category
  landuseColors.forEach((d) => {
    if (d.length > 1) {
      // create a legend item
      const landuseLegendItem = document.createElement("div");
      landuseLegendItem.className = "legend-item";

      // create a legend item color
      const landuseLegendItemColor = document.createElement("div");
      landuseLegendItemColor.className = "legend-key";
      landuseLegendItemColor.style.display = "inline-block";
      landuseLegendItemColor.style.backgroundColor = d[1];

      //   create a legend item label
      const landuseLegendItemLabel = document.createElement("div");
      landuseLegendItemLabel.className = "legend-item-label";
      landuseLegendItemLabel.innerHTML = d[0];
      landuseLegendItem.appendChild(landuseLegendItemColor);
      landuseLegendItem.appendChild(landuseLegendItemLabel);
      landuseLegendContainer.appendChild(landuseLegendItem);
    }
  });

  landuseLegend.appendChild(landuseLegendContainer);
  // append the legend to the document body
  document.body.appendChild(landuseLegend);

  // create legend
  const legend = document.getElementById("legend");

  //   create a title for the legend
  const title = document.createElement("h2");
  title.id = "legend-title";
  title.textContent = "Population Density";
  legend.appendChild(title);

  //   create a child element for the legend explaining the metric
  const description = document.createElement("p");
  description.id = "legend-description";
  description.textContent = "People per square km";
  legend.appendChild(description);

  //   create a container for the actual legend items
  const ramp = document.createElement("div");
  ramp.className = "legend-items";

  // get the values and color for the legend from the same scale as the choropleth layer
  const [legendValues, legendColors] = [scale[1], scale[2]];

  //   create a legend item for each value and color
  legendValues.forEach((layer, i) => {
    const color = legendColors[i];
    const item = document.createElement("div");
    const key = document.createElement("div");
    key.className = "legend-key";
    key.style.backgroundColor = color;

    const value = document.createElement("div");
    value.innerHTML = `${round(layer)}`;
    item.appendChild(key);
    item.appendChild(value);
    ramp.appendChild(item);
  });
  //  add the legend items to the legend
  legend.appendChild(ramp);

  // add a popup to the map on hover
  const hoverPopup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false,
  });

  // add a popup on hover over the population geojson
  map.on("mousemove", "phillyPop", (e) => {
    // if the mouse is over a feature and the zoom is less than 10
    if (e.features.length > 0 && map.getZoom() < 11) {
      // set the cursor to pointer
      map.getCanvas().style.cursor = "pointer";
      const { POP_DENSITY } = e.features[0].properties;
      hoverPopup
        .setLngLat(e.lngLat)
        .setHTML(
          `<h3>Population Density</h3><p><em>${round(
            POP_DENSITY
          )} people per square km</em></p>`
        )
        .addTo(map);
    }
  });

  // When the mouse leaves the choropleth, remove the popup from the previous feature.
  map.on("mouseleave", "phillyPop", () => {
    // set the cursor to default
    map.getCanvas().style.cursor = "";
    hoverPopup.remove();
  });
});

/**
 * AUTO GENERATE LEGEND
 * This section offers two methods to generate a legend: Quantile and Equal Interval
 * Quantile is often used for choropleth maps, while Equal Interval is often used for heatmaps.
 * Both methods are acceptable, but tell a different story.
 *
 * In this example, we will use Quantile to generate our legend, but you can easily switch to Equal Interval
 * by switching the getQuantileScale function to getEqualIntervalScale throughout the code.
 *
 * I encourage you to check both methods and see which one tells a better story for your data.
 *
 * CASE 1: QUANTILE SCALE:
 * Quantile slices the domain into intervals of (roughly) equal absolute frequency
 * (i.e. equal number of individuals for each color)
 */

// number of bins for your legend
const numberOfBins = 6;

// styles for our choropleth map
let colorRamp = {
  red: [
    "#f7f4f9",
    "#e7e1ef",
    "#d4b9da",
    "#c994c7",
    "#df65b0",
    "#e7298a",
    "#ce1256",
    "#980043",
    "#67001f",
  ],
  blue: [
    "#ffffd9",
    "#edf8b1",
    "#c7e9b4",
    "#7fcdbb",
    "#41b6c4",
    "#1d91c0",
    "#225ea8",
    "#253494",
    "#081d58",
  ],
  greyScale: [
    "#3F3F43",
    "#515155",
    "#646467",
    "#777779",
    "#8A8A8C",
    "#9C9C9E",
    "#AFAFB0",
    "#C2C2C2",
    "#D5D5D5",
    "#D5D5D5",
  ],
  qualitative: [
    "#e41a1c",
    "#377eb8",
    "#4daf4a",
    "#984ea3",
    "#ff7f00",
    "#ffff33",
    "#a65628",
    "#f781bf",
    "#999999",
  ],
};

// select the color ramp to be used
const selectedColorRamp = colorRamp.greyScale;

function getMapScale(jsonSource, prop, scaleType) {
  if (scaleType === "equalInterval") {
    return getEqualIntervalScale(jsonSource, prop);
  } else {
    return getQuantileScale(jsonSource, prop);
  }
}

function getQuantileScale(jsonSource, prop) {
  /**
   * @param {array} jsonSource - the data source
   * @param {string} prop - the property to be used for the scale
   */

  //sort the data in ascending order and assign to a data array
  const data = jsonSource.features
    .map((el) => el.properties[prop])
    .sort((a, b) => a - b);

  // create a quantile function based off the data array and assign to the colors array
  const color = d3.scaleQuantile().domain(data).range(selectedColorRamp);

  // get the quantile breaks of the data property
  const quantileBreaks = Math.floor(data.length / numberOfBins + 1);

  // get the min value of each group
  const groups = [];
  for (let i = 0; i < numberOfBins; i++) {
    // divide data into groups of equal size (quantileBreaks)
    groups.push(
      d3.min(data.slice(i * quantileBreaks, (i + 1) * quantileBreaks))
    );
  }
  // for each density break, get the color using our quantile function
  const colorBreaks = groups.map((d) => color(d));

  // combine density breaks and color breaks into an array of objects
  const colorScale = groups
    .map((d, i) => {
      return Object.values({
        density: d,
        color: colorBreaks[i],
      });
    })
    .flat();

  //return an array with the color scale, the groups, and the color breaks
  return [colorScale, groups, colorBreaks];
}

/**
 * CASE 2: EQUAL INTERVAL SCALE:
 * Equal interval slices the domain into intervals of (roughly) equal width
 * (i.e. equal range of values for each color)
 */

function getEqualIntervalScale(jsonSource, prop) {
  /**
   * @param {array} jsonSource - the data source
   * @param {string} prop - the property to be used for the scale
   */

  //sort the data in ascending order and assign to a data array
  const data = jsonSource.features
    .map((el) => el.properties[prop])
    .sort((a, b) => a - b);

  // divide the range of the data into equal intervals
  const interval = (d3.max(data) - d3.min(data)) / numberOfBins;

  // get the value at each threshold (i.e. the min value of each interval)
  const groups = [];
  for (let i = 0; i < numberOfBins; i++) {
    groups.push(d3.min(data) + i * interval);
  }

  //   break down the color ramp to match the number of bins, from the middle out
  const halfRamp1 = [];
  const halfRamp2 = [];

  for (let i = 0; i < numberOfBins; i++) {
    if (i % 2 == 0) {
      halfRamp1.push(selectedColorRamp[i]);

      if (halfRamp1.length + halfRamp2.length == numberOfBins) {
        break;
      }
    } else {
      halfRamp2.push(selectedColorRamp[selectedColorRamp.length - i]);
      if (halfRamp1.length + halfRamp2.length == numberOfBins) {
        break;
      }
    }
  }

  // combine the two color ramps into one after reversing the second one
  const colorRamp = halfRamp1.concat(halfRamp2.reverse());

  // create a linear scale based off the data array and assign to the colors array
  const color = d3.scaleThreshold().domain(groups).range(colorRamp);

  // for each threshold, get the color
  const colorBreaks = groups.map((d) => {
    return color(d);
  });

  // combine values and color breaks into an array of objects
  const colorScale = groups
    .map((d, i) => {
      return Object.values({
        density: d,
        color: colorBreaks[i],
      });
    })
    .flat();

  // return an array with the color scale, the groups, and the color breaks
  return [colorScale, groups, colorBreaks];
}

/**
 * Utilities- This section contains functions that are used to check if the device is mobile
 * and to round any numbers to a legible number of significant digits
 */

// create a function to check if device is mobile
const mobileCheck = () => {
  return window.innerWidth < 768;
};

// multiple the size of our points if the device is mobile
const pointScaleMultiplier = mobileCheck() ? 2 : 1;

//   create a function to round the number to a significant digit
function round(value) {
  if (value < 1) {
    return value.toFixed(2);
  }
  if (value < 10) {
    return Math.round(value * 10) / 10;
  }
  if (value < 100) {
    return Math.round(value);
  }
  if (value < 1000) {
    return Math.round(value / 10) * 10;
  }
  if (value >= 1000) {
    return Math.round(value / 1000) + "k";
  }
}