import sourceInfo from "./data/stateData.geojson" assert { type: "json" };

// number of bins for your legend
const numberOfBins = 6;

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

const selectedColorRamp = colorRamp.blue;

const scaleTypes = {
  quantile: getQuantileScale(),
  equalInterval: getEqualIntervalScale(),
  qualitative: getQualitativeScale(),
};

const selectedScale = scaleTypes.quantile;

/**
 * CASE 1: QUANTILE SCALE:
 * Quantile slices the domain into intervals of (roughly) equal absolute frequency
 * (i.e. equal number of individuals for each color)
 */

function getQuantileScale() {
  // get density property from each state info entry
  const data = sourceInfo.features
    .map((state) => state.properties.density)
    .sort((a, b) => a - b);

  const color = d3.scaleQuantile().domain(data).range(selectedColorRamp);

  // get the quantile breaks of the state density
  const quantileBreaks = Math.floor(data.length / numberOfBins + 1);

  // get the min value of each group
  const groups = [];
  for (let i = 0; i < numberOfBins; i++) {
    // divide data into groups of equal size (quantileBreaks)
    groups.push(
      d3.min(data.slice(i * quantileBreaks, (i + 1) * quantileBreaks))
    );
  }
  // for each density break, get the color
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
  return [colorScale, groups, colorBreaks];
}

/**
 * CASE 2: EQUAL INTERVAL SCALE:
 * Equal interval slices the domain into intervals of (roughly) equal width
 * (i.e. equal range of values for each color)
 */

function getEqualIntervalScale() {
  // get density property from each state info entry
  const data = sourceInfo.features
    .map((state) => state.properties.density)
    .sort((a, b) => a - b);

  const color = d3
    .scaleQuantize()
    .domain(d3.extent(data))
    .range(selectedColorRamp);

  // get the min value of each
  const groups = [];
  for (let i = 0; i < numberOfBins; i++) {
    // divide data into groups of equal size (quantileBreaks)
    groups.push(d3.min(data.slice(i * numberOfBins, (i + 1) * numberOfBins)));
  }

  // for each density break, get the color
  const colorBreaks = groups.map((d) => color(d));

  console.log(d3.extent(data), colorBreaks);
  // combine density breaks and color breaks into an array of objects
  const colorScale = groups
    .map((d, i) => {
      return Object.values({
        density: d,
        color: colorBreaks[i],
      });
    })
    .flat();
  return [colorScale, groups, colorBreaks];
}

// create function for qualitative data
function getQualitativeScale() {
  const data = sourceInfo.features.map((state) => state.properties.race);

  // get the total number of unique responses
  const uniqueResponses = [...new Set(data)];

  // create a color scale for each unique response
  const color = d3
    .scaleOrdinal()
    .domain(uniqueResponses)
    .range(colorRamp.qualitative.slice(0, uniqueResponses.length));

  // get the color for each unique response
  const colorBreaks = uniqueResponses.map((d) => color(d));

  // combine density breaks and color breaks into an array of objects
  const colorScale = uniqueResponses
    .map((d, i) => {
      return Object.values({
        race: d,
        color: colorBreaks[i],
      });
    })
    .flat();
  return [colorScale, uniqueResponses, colorBreaks];
}

mapboxgl.accessToken =
  "pk.eyJ1Ijoibmlrby1kZWxsaWMiLCJhIjoiY2w5c3p5bGx1MDh2eTNvcnVhdG0wYWxkMCJ9.4uQZqVYvQ51iZ64yG8oong";
const map = new mapboxgl.Map({
  container: "map", // Container ID
  style: "mapbox://styles/niko-dellic/cl9t226as000x14pr1hgle9az", // Map style to use
  center: [-94.09561, 40.3638], // Starting position [lng, lat]
  zoom: 4, // Starting zoom level
  projection: "globe",
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

map.on("load", () => {
  // Add a source for the GeoJSON data.
  map.addSource("states", {
    type: "geojson",
    data: "./data/stateData.geojson",
  });

  // Add a layer to visualize the state polygons.
  map.addLayer({
    id: "statedata",
    type: "fill",
    source: "states", // reference the data source
    layout: {},
    paint: {
      //   style the layer based on the density property
      "fill-color": [
        "interpolate",
        ["linear"],
        ["get", "density"],
        ...selectedScale[0],
        // ...getLegend("states"),
      ],

      "fill-opacity": [
        "case",
        ["boolean", ["feature-state", "hover"], false],
        1,
        1,
      ],
    },
  });

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

  // create legend
  const legend = document.getElementById("legend");
  const [legendValues, legendColors] = [selectedScale[1], selectedScale[2]];
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
    legend.appendChild(item);
  });

  map.on("mousemove", (event) => {
    const states = map.queryRenderedFeatures(event.point, {
      layers: ["statedata"],
    });
    document.getElementById("pd").innerHTML = states.length
      ? `<h3>${states[0].properties.name}</h3><p><strong><em>${states[0].properties.density}</strong> people per square mile</em></p>`
      : `<p>Hover over a state!</p>`;
  });
});
