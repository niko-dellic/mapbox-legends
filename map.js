import phillyPopStats from "./data/Vital_Population_CT.geojson" assert { type: "json" };

// use turf.area to calculate the area of each of the phillypopstats
phillyPopStats.features.forEach((d) => {
  //   const polygon = turf.polygon([[d.geometry.coordinates[0]]]);

  //   console.log(polygon);
  d.properties["area_km"] = turf.area(d) / 1000;

  //   console.log(d.properties.Shape__Area);
  d.properties["POP_DENSITY"] =
    d.properties.COUNT_ALL_RACES_ETHNICITIES / d.properties["area_km"];
});

// calculate population density for pop stats
phillyPopStats.features.forEach((d, index) => {});

//   filter out the entries whose population density is less than 1
phillyPopStats.features = phillyPopStats.features.filter((d) => {
  return d.properties.POP_DENSITY > 0.05;
});

// number of bins for your legend
const numberOfBins = 6; //max is 9

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

const selectedColorRamp = colorRamp.red;

// check if device is mobile
const mobileCheck = () => {
  return window.innerWidth < 768;
};

const isMobile = mobileCheck();

const pointScaleMultiplier = isMobile ? 3 : 1;

/**
 * CASE 1: QUANTILE SCALE:
 * Quantile slices the domain into intervals of (roughly) equal absolute frequency
 * (i.e. equal number of individuals for each color)
 */

function getQuantileScale(jsonSource, prop) {
  /**
   * @param {array} jsonSource - the data source
   * @param {string} prop - the property to be used for the scale
   */

  const data = jsonSource.features
    .map((el) => el.properties[prop])
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

function getEqualIntervalScale(jsonSource, prop) {
  /**
   * @param {array} jsonSource - the data source
   * @param {string} prop - the property to be used for the scale
   */

  // get density property from each state info entry
  const data = jsonSource.features
    .map((el) => el.properties.prop)
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

mapboxgl.accessToken =
  "pk.eyJ1Ijoibmlrby1kZWxsaWMiLCJhIjoiY2w5c3p5bGx1MDh2eTNvcnVhdG0wYWxkMCJ9.4uQZqVYvQ51iZ64yG8oong";
const map = new mapboxgl.Map({
  container: "map", // Container ID
  style: "mapbox://styles/niko-dellic/cl9t226as000x14pr1hgle9az", // Map style to use
  //   center: [-94.09561, 40.3638], // Starting position [lng, lat]
  //   zoom: 4, // Starting zoom level
  projection: "globe",
  //   center on new york city
  //   center: [-74.006, 40.7128],
  //   center on philadelphia
  center: [-75.1638, 39.9526],
  zoom: 10,
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
  //   add source for philly data
  map.addSource("phillyPop", {
    type: "geojson",
    data: phillyPopStats,
  });

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
        ...getQuantileScale(phillyPopStats, "POP_DENSITY")[0],
      ],
      //   change opacity based on zoom level
      "fill-opacity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        7,
        0,
        9,
        0.8,
        12,
        0.5,
        13,
        0,
      ],
    },
  });

  fetch(
    "https://phl.carto.com/api/v2/sql?format=GeoJSON&q=SELECT * FROM public_cases_fc WHERE requested_datetime >= current_date - 14"
  )
    .then((response) => response.json())
    .then((data) => {
      const responseTypes = {};
      const philly311 = data.features.filter(
        (d) => d.geometry !== null && d.properties.subject !== null
      );

      philly311.forEach((d) => {
        d.properties.subject = d.properties.subject.toUpperCase();

        if (responseTypes[d.properties.subject]) {
          responseTypes[d.properties.subject] += 1;
        } else {
          responseTypes[d.properties.subject] = 1;
        }
      });

      //   create a function to get the top 10 responses
      function getTopTenResponses(data) {
        const complaintArray = Object.entries(data).sort((a, b) => b[1] - a[1]);

        //   return array to object
        const responseTypesObject = complaintArray.reduce(
          (obj, [key, value]) => {
            obj[key] = value;
            return obj;
          },
          {}
        );

        const topTen = Object.entries(data)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .reduce((obj, [key, value]) => {
            obj[key] = value;
            return obj;
          }, {});
        return topTen;
      }

      data.features = philly311;
      map.addSource("philly311", {
        type: "geojson",
        data: data,
        promoteId: "cartodb_id",
      });

      map.addLayer({
        id: "philly311Circles",
        type: "circle",
        source: "philly311",
        layout: {},
        paint: {
          // set the circle opacity based on zoom level
          "circle-opacity": ["interpolate", ["linear"], ["zoom"], 10, 0, 12, 1],

          //   change the stroke opacity based on zoom
          "circle-stroke-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10,
            0,
            12,
            1,
          ],

          "circle-pitch-scale": "viewport",
          //   filter color based on status and then display as categorical data
          //   "circle-color":
          //     //   if the status is closed
          //     ["case", ["==", ["get", "status"], "Closed"], "blue", "red"],

          // assign circle color based on the subject of the complaint
          "circle-color": [
            "match",
            ["get", "subject"],
            "MAINTENANCE COMPLAINT",
            "rgb(244, 133, 0)",
            "ILLEGAL DUMPING",
            "rgb(29, 168, 39)",
            "ABANDONED AUTOMOBILE",
            "rgb(80, 128, 234)",
            "ABANDONED VEHICLE",
            "rgb(80, 128, 234)",
            "RUBBISH/RECYCLABLE MATERIAL COLLECTION",
            "rgb(128, 63, 138)",
            "GRAFFITI REMOVAL",
            "rgb(252, 75, 56)",
            "CONSTRUCTION COMPLAINTS",
            "rgb(128, 63, 138)",
            "RUBBISH COLLECTION",
            "rgb(128, 63, 138)",
            "POTHOLE REPAIR",
            "rgb(252, 75, 56)",
            "STREET LIGHT OUTAGE",
            "rgb(128, 63, 138)",
            "rgba(33, 33, 33, 125)", //fallback for other
          ],
          //   change the stroke color based on the status
          "circle-stroke-color": [
            "match",
            ["get", "status"],
            "Closed",
            "rgb(30,30,30)", //closed tickets
            "white", //open tickets
          ],
          //   set the stroke width based on the hover state
          "circle-stroke-width": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            4,
            1,
          ],

          //   set the circle radius based on the hover state
          "circle-radius": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            10 * pointScaleMultiplier,
            5 * pointScaleMultiplier,
          ],
        },
      });
    });

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
  ramp.id = "legend-items";

  const [legendValues, legendColors] = [
    getQuantileScale(phillyPopStats, "POP_DENSITY")[1],
    getQuantileScale(phillyPopStats, "POP_DENSITY")[2],
  ];
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
  legend.appendChild(ramp);

  //   update the hover tooltip
  map.on("mousemove", (event) => {
    const bounds = map.queryRenderedFeatures(event.point, {
      layers: ["philly311Circles"],
    });

    if (bounds.length > 0) {
      const { subject, status, requested_datetime, address } =
        bounds[0].properties;
      document.getElementById(
        "pd"
      ).innerHTML = `<h3>${address}</h3><p><em>${subject}<p>Status: ${status}</p><p>${requested_datetime}</p></em></p>`;
    }
  });
});

let hoveredStateId = null;

// change stroke width of philly311 points on hover

map.on("mousemove", "philly311Circles", (e) => {
  if (e.features.length > 0) {
    // set the cursor to pointer
    map.getCanvas().style.cursor = "pointer";

    if (hoveredStateId) {
      map.setFeatureState(
        { source: "philly311", id: hoveredStateId },
        { hover: false }
      );
    }
    hoveredStateId = e.features[0].id;
    map.setFeatureState(
      { source: "philly311", id: hoveredStateId },
      { hover: true }
    );
  }
});

// When the mouse leaves the state-fill layer, update the feature state of the
// previously hovered feature.
map.on("mouseleave", "philly311Circles", () => {
  // set the cursor to default
  map.getCanvas().style.cursor = "";

  if (hoveredStateId) {
    map.setFeatureState(
      { source: "philly311", id: hoveredStateId },
      { hover: false }
    );
  }
  hoveredStateId = null;
});

// map on click fly to point
map.on("click", "philly311Circles", (e) => {
  // console log the current bearing
  console.log(map.getStyle().bearing);
  map.flyTo({
    center: e.features[0].geometry.coordinates,
    zoom: 18,
    pitch: 60,
    // get a random bearing between 0 and 360
    bearing: Math.floor(Math.random() * 180),
  });
});
