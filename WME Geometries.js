// ==UserScript==
// @name                WME Geometries (JS55CT Fork)
// @namespace           https://github.com/JS55CT
// @description         Import geometry files into Waze Map Editor. Supports GeoJSON, GML, WKT, KML, and GPX (Modified from original).
// @version             2025.02.23.01
// @downloadURL         https://raw.githubusercontent.com/JS55CT/WME-Geometries-JS55CT-Fork/main/WME%20Geometries.js
// @updateURL           https://raw.githubusercontent.com/JS55CT/WME-Geometries-JS55CT-Fork/main/WME%20Geometries.js
// @author              JS55CT
// @match               https://www.waze.com/*/editor*
// @match               https://www.waze.com/editor*
// @match               https://beta.waze.com/*
// @exclude             https://www.waze.com/*user/*editor/*
// @require             https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.4.4/lz-string.min.js
// @require             https://greasyfork.org/scripts/24851-wazewrap/code/WazeWrap.js
// @require             https://cdnjs.cloudflare.com/ajax/libs/openlayers/2.13.1/lib/OpenLayers/Format/WKT.js
// @require             https://cdnjs.cloudflare.com/ajax/libs/openlayers/2.13.1/lib/OpenLayers/Format/GML.js
// @require             https://cdnjs.cloudflare.com/ajax/libs/openlayers/2.13.1/lib/OpenLayers/Format/GPX.js
// @require             https://cdnjs.cloudflare.com/ajax/libs/openlayers/2.13.1/lib/OpenLayers/Format/KML.js
// @require             https://cdnjs.cloudflare.com/ajax/libs/openlayers/2.13.1/lib/OpenLayers/Format/GeoJSON.js
// @require             https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.15.0/proj4-src.js
// @require             https://update.greasyfork.org/scripts/524747/1528426/GeoKMLer.js
// @require             https://update.greasyfork.org/scripts/527113/1538327/GeoKMZer.js
// @require             https://update.greasyfork.org/scripts/523986/1528425/GeoWKTer.js
// @require             https://update.greasyfork.org/scripts/523870/1521199/GeoGPXer.js
// @require             https://update.greasyfork.org/scripts/526229/1533569/GeoGMLer.js
// @require             https://update.greasyfork.org/scripts/526996/1537647/GeoSHPer.js
// @connect             tigerweb.geo.census.gov
// @grant               unsafeWindow
// @grant               GM_xmlhttpRequest
// @license             MIT
// @original-author     Timbones
// @original-contributors wlodek76, Twister-UK
// @original-source     https://greasyfork.org/en/scripts/8129-wme-geometries
// ==/UserScript==

/********
 * TO DO LIST:
 *  1. Update Labels for line feachers for pathLabel? and pathLabelCurve?  Need to understand installPathFollowingLabels() more.
 *********/

/*
External Variables and Objects:
GM_info: 
unsafeWindow: 
W: Represents the global Waze Map Editor object
WazeWrap: external utility library for interacting with the Waze Map Editor environment.
LZString: library used for compressing and decompressing strings.
OpenLayers: A global object referring to the OpenLayers library
proj4: Proj4-src.js version 2.15.0
GeoWKTer, GeoGPXer, GeoGMLer, GeoKMLer, GeoKMZer, GeoSHPer external classes/functions used for parsing geospatial data formats.
*/

var geometries = function () {
  "use strict";
  const scriptMetadata = GM_info.script;
  const scriptName = scriptMetadata.name;
  let geolist;
  let debug = false;
  let forceGeoJSON = false; // Default to using OpenLayers Parser
  let formats;
  let formathelp;
  let layerindex = 0;
  let storedLayers = [];
  let db;
  let groupToggler;
  let projectionMap = {};

  function layerStoreObj(fileContent, color, fileext, filename, fillOpacity, fontsize, lineopacity, linesize, linestyle, labelpos, labelattribute, orgFileext) {
    this.fileContent = fileContent;
    this.color = color;
    this.fileext = fileext;
    this.filename = filename;
    this.fillOpacity = fillOpacity;
    this.fontsize = fontsize;
    this.lineopacity = lineopacity;
    this.linesize = linesize;
    this.linestyle = linestyle;
    this.labelpos = labelpos;
    this.labelattribute = labelattribute;
    this.orgFileext = orgFileext;
  }

  let wmeSDK; // Declare wmeSDK globally

  // Ensure SDK_INITIALIZED is available
  if (unsafeWindow.SDK_INITIALIZED) {
    unsafeWindow.SDK_INITIALIZED.then(bootstrap).catch((err) => {
      console.error(`${scriptName}: SDK initialization failed`, err);
    });
  } else {
    console.warn(`${scriptName}: SDK_INITIALIZED is undefined`);
  }

  function bootstrap() {
    wmeSDK = unsafeWindow.getWmeSdk({
      scriptId: scriptName.replaceAll(" ", ""),
      scriptName: scriptName,
    });

    // Wait for both WME and WazeWrap to be ready
    Promise.all([isWmeReady(), isWazeWrapReady()])
      .then(() => {
        console.log(`${scriptName}: All dependencies are ready.`);
        // Initialize formats and formathelp here
        ({ formats, formathelp } = createLayersFormats());
        init();
      })
      .catch((error) => {
        console.error(`${scriptName}: Error during bootstrap -`, error);
      });
  }

  function isWmeReady() {
    return new Promise((resolve, reject) => {
      if (wmeSDK && wmeSDK.State.isReady() && wmeSDK.Sidebar && wmeSDK.LayerSwitcher && wmeSDK.Shortcuts && wmeSDK.Events) {
        resolve();
      } else {
        wmeSDK.Events.once({ eventName: "wme-ready" })
          .then(() => {
            if (wmeSDK.Sidebar && wmeSDK.LayerSwitcher && wmeSDK.Shortcuts && wmeSDK.Events) {
              console.log(`${scriptName}: WME is fully ready now.`);
              resolve();
            } else {
              reject(`${scriptName}: Some SDK components are not loaded.`);
            }
          })
          .catch((error) => {
            console.error(`${scriptName}: Error while waiting for WME to be ready:`, error);
            reject(error);
          });
      }
    });
  }

  function isWazeWrapReady() {
    return new Promise((resolve, reject) => {
      (function check(tries = 0) {
        if (unsafeWindow.WazeWrap && unsafeWindow.WazeWrap.Ready) {
          resolve();
        } else if (tries < 1000) {
          setTimeout(() => {
            check(++tries);
          }, 500);
        } else {
          reject(`${scriptName}: WazeWrap took too long to load.`);
        }
      })();
    });
  }

  /**
   * loadLayers
   * 
   * Loads all saved layers from the IndexedDB and processes each one asynchronously.
   * This function retrieves the entire set of stored layers, decompresses them,
   * and invokes the parsing function for each layer, enabling them to be rendered or manipulated further.
   *
   * Workflow Details:
   * 1. Logs the start of the loading process to the console.
   * 2. Initiates a read-only transaction with the IndexedDB to fetch all stored layers.
   * 3. If layers are available:
   *    a. Displays a parsing message indicating processing is underway.
   *    b. Iterates over each stored layer asynchronously, using `loadLayer` to fetch and decompress each layer individually.
   *    c. Calls `parseFile` on each successfully loaded layer to process and render it.
   *    d. Ensures the parsing message is hidden upon completion of all operations.
   * 4. Logs a message when no layers are present to be loaded.
   *
   * Error Handling:
   * - Logs and rejects any errors occurring during the IndexedDB retrieval process.
   * - Catches and logs errors for each specific layer processing attempt to avoid interrupting the overall loading sequence.
   *
   * @returns {Promise} - Resolves when all operations are complete, whether successful or encountering errors in parts.
   */
  async function loadLayers() {
    console.log(`${scriptName}: Loading Saved Layers...`);

    // Check local storage for any legacy layers
    if (localStorage.WMEGeoLayers !== undefined) {
    WazeWrap.Alerts.info( scriptName, "Old layers were found in local storage. These will be deleted. Please reload your files to convert them to IndexedDB storage.");
    localStorage.removeItem("WMEGeoLayers");
    console.log(`${scriptName}: Old layers in local storage have been deleted. Please reload your files.`);
  }

    // Continue by loading layers stored in IndexedDB
    const transaction = db.transaction(["layers"], "readonly");
    const store = transaction.objectStore("layers");
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = async function () {
        const storedLayers = request.result || [];

        if (storedLayers.length > 0) {
          try {
            toggleParsingMessage(true);

            const layerPromises = storedLayers.map(async (storedLayer) => {
              try {
                const layer = await loadLayer(storedLayer.filename);
                if (layer) {
                  parseFile(layer);
                }
              } catch (error) {
                console.error(`${scriptName}: Error processing layer:`, error);
              }
            });

            await Promise.all(layerPromises);
          } finally {
            toggleParsingMessage(false);
          }
        } else {
          console.log(`${scriptName}: No layers to load.`);
        }

        resolve();
      };

      request.onerror = function (event) {
        console.error(`${scriptName}: Error loading layers from IndexedDB`, event.target.error);
        reject(new Error("Failed to load layers from database"));
      };
    });
  }

  /**
   * Fetches and decompresses a specified layer from the IndexedDB by its filename.
   * This function handles the retrieval of a single layer, decompressing its data for subsequent usage.
   *
   * @param {string} filename - The name of the file representing the layer to be loaded.
   *
   * Workflow Details:
   * 1. Initiates a read-only transaction with the IndexedDB to fetch layer data by the filename.
   * 2. On successful retrieval:
   *    a. Decompresses the stored data using LZString and parses it back to its original form.
   *    b. Resolves the promise with the full decompressed data object.
   * 3. If no data is found for the specified filename, resolves with `null`.
   *
   * Error Handling:
   * - Logs errors to the console if data retrieval from the database fails.
   * - Rejects the promise with an error if data fetching is unsuccessful.
   *
   * @returns {Promise<Object|null>} - Resolves with the decompressed layer object if successful, or `null` if not found.
   */
  async function loadLayer(filename) {
    const transaction = db.transaction(["layers"], "readonly");
    const store = transaction.objectStore("layers");
    const request = store.get(filename);

    return new Promise((resolve, reject) => {
      request.onsuccess = function () {
        const result = request.result;
        if (result) {
          // Decompress the entire stored object
          const decompressedFileObj = JSON.parse(LZString.decompress(result.compressedData));
          resolve(decompressedFileObj); // Return the full decompressed object
        } else {
          resolve(null);
        }
      };

      request.onerror = function (event) {
        console.error("Error retrieving layer:", event.target.error);
        reject(new Error("Failed to fetch layer data"));
      };
    });
  }

  /*********************************************************************
   * init
   *
   * Description:
   * Initializes the user interface for the "WME Geometries" sidebar tab in the Waze Map Editor. This function sets up
   * the DOM structure, styles, event listeners, and interactions necessary for importing and working with geometric
   * files and Well-Known Text (WKT) inputs.
   *
   * Parameters:
   * - This function does not take any direct parameters but interacts with global objects and the document's DOM.
   *
   * Behavior:
   * - Registers a new sidebar tab labeled "GEO" using Waze's userscript API.
   * - Builds a user interface dynamically, adding elements such as title sections, file inputs, and buttons for importing
   *   and clearing WKT data.
   * - Configures event listeners for file input changes and button clicks to handle layer management and WKT drawing.
   * - Sets default styles and hover effects for UI components to enhance user experience.
   * - Displays information about available formats and coordinate systems to guide users in their inputs.
   * - Ensures that the existing layers are loaded upon initialization by calling a separate function, `loadLayers`.
   * - Provides console logging to trace the steps and confirm successful loading of the UI, with debug messages when applicable.
   *
   * Notes:
   * - Relies on global variables and elements such as `W.userscripts`, `W.map`, and custom functions like `addGeometryLayer`, `drawStateBoundary`, and `draw_WKT`.
   * - Incorporates CSS styling to maintain consistency with the WME environment and improve usability.
   *************************************************************************/
  async function init() {
    console.log(`${scriptName}: Loading User Interface ...`);

    wmeSDK.Sidebar.registerScriptTab().then(({ tabLabel, tabPane }) => {
      tabLabel.textContent = "GEO";
      tabLabel.title = `${scriptName}`;

      let geobox = document.createElement("div");
      geobox.style.cssText = "padding: 5px; background-color: #fff; border: 2px solid #ddd; border-radius: 5px; box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.1);";
      tabPane.appendChild(geobox);

      let geotitle = document.createElement("div");
      geotitle.innerHTML = GM_info.script.name;
      geotitle.style.cssText = "text-align: center; font-size: 1.1em; font-weight: bold; color: #222;";
      geobox.appendChild(geotitle);

      let geoversion = document.createElement("div");
      geoversion.innerHTML = "v " + GM_info.script.version;
      geoversion.style.cssText = "text-align: center; font-size: 0.9em; color: #222;";
      geobox.appendChild(geoversion);

      let hr = document.createElement("hr");
      hr.style.cssText = "margin-top: 3px; margin-bottom: 3px; border: 0; border-top: 1px solid hsl(0, 0%, 93.5%);";
      geobox.appendChild(hr);

      geolist = document.createElement("ul");
      geolist.style.cssText = "margin: 5px 0; padding: 5px;";
      geobox.appendChild(geolist);

      let hr1 = document.createElement("hr");
      hr1.style.cssText = "margin-top: 3px; margin-bottom: 3px; border: 0; border-top: 1px solid hsl(0, 0%, 93.5%);";
      geobox.appendChild(hr1);

      let geoform = document.createElement("form");
      geoform.style.cssText = "display: flex; flex-direction: column; gap: 0px;";
      geoform.id = "geoform";
      geobox.appendChild(geoform);

      let fileContainer = document.createElement("div");
      fileContainer.style.cssText = "position: relative; display: inline-block;";

      let inputfile = document.createElement("input");
      inputfile.type = "file";
      inputfile.id = "GeometryFile";
      inputfile.title = ".geojson, .gml or .wkt";
      inputfile.style.cssText = "opacity: 0; position: absolute; top: 0; left: 0; width: 95%; height: 100%; cursor: pointer; pointer-events: none;";
      fileContainer.appendChild(inputfile);

      let customLabel = createButton("Import GEO File", "#8BC34A", "#689F38", "#FFFFFF", "label", "GeometryFile");
      fileContainer.appendChild(customLabel);
      geoform.appendChild(fileContainer);

      inputfile.addEventListener("change", addGeometryLayer, false);

      let notes = document.createElement("p");
      notes.innerHTML = `
    <b>Formats:</b><br>
    ${formathelp}<br>
    <b>EPSG:</b> <br>
    | 3035 | 3414 | 4214 | 4258 | 4267 | 4283 |<br>
    | 4326 | 25832 | 26901->26923 | 27700 |<br>
    | 32601->32660 | 32701->32760 |`;
      notes.style.cssText = "color: #555; display: block; font-size: 0.9em; margin-left: 0px; margin-bottom: 0px;";
      geoform.appendChild(notes);

      let hrElement0 = document.createElement("hr");
      hrElement0.style.cssText = "margin: 5px 0; border: 0; border-top: 1px solid #ddd;";
      geoform.appendChild(hrElement0);

      let usCensusB = document.createElement("p");
      usCensusB.innerHTML = `
        <b><a href="https://tigerweb.geo.census.gov/tigerwebmain/TIGERweb_main.html" target="_blank" style="color: #555; text-decoration: underline;">
          US Census Bureau:
        </a></b>`;
      usCensusB.style.cssText = "color: #555; display: block; font-size: 0.9em; margin-left: 0px; margin-bottom: 0px;";
      geoform.appendChild(usCensusB);

      // State Boundary Button
      const stateBoundaryInfoHtml = `
      <b><a href="https://tigerweb.geo.census.gov/tigerwebmain/TIGERweb_geography_details.html#STATE" target="_blank" style="color: #555; text-decoration: underline;">
      States:
      </a></b><br>
      States and Equivalent Entities that are the primary governmental divisions of the United States.
      `;
      const stateBoundaryButtonContainer = createButtonWithInfo("Draw State Boundary", "#E57373", "#D32F2F", "#FFFFFF", "button", stateBoundaryInfoHtml);
      stateBoundaryButtonContainer.querySelector("button").addEventListener("click", (event) => {
        event.preventDefault();
        drawBoundary("state");
      });
      geoform.appendChild(stateBoundaryButtonContainer);

      // County Boundary Button
      const countyBoundaryInfoHtml = `
      <b><a href="https://tigerweb.geo.census.gov/tigerwebmain/TIGERweb_geography_details.html#COUNTY" target="_blank" style="color: #555; text-decoration: underline;">
      Counties:
      </a></b><br>
      In most states, primary legal divisions are called counties.<br>
      LA uses parishes, while AK uses organized boroughs, cities and boroughs, municipalities, and census areas.<br>
      MD, MO, NV, and VA have independent cities acting as primary divisions outside of counties.<br>
      DC & GU are treated as single entities.<br>
      CT by Planning Regions, RI & parts of MA, counties no longer function administratively but data is still provided for these areas.<br>
      Municipios in PR, Districts & Islands in AS, Municipalities in MP, and Islands in VI.
      `;
      const countyBoundaryButtonContainer = createButtonWithInfo("Draw County Boundary", "#8BC34A", "#689F38", "#FFFFFF", "button", countyBoundaryInfoHtml);
      countyBoundaryButtonContainer.querySelector("button").addEventListener("click", (event) => {
        event.preventDefault();
        drawBoundary("county");
      });
      geoform.appendChild(countyBoundaryButtonContainer);

      // countySub Boundary Button
      const countySubBoundaryInfoHtml = `
      <b><a href="https://tigerweb.geo.census.gov/tigerwebmain/TIGERweb_geography_details.html#COUSUB" target="_blank" style="color: #555; text-decoration: underline;">
      County Subdivisions:
      </a></b><br>
      County Subdivisions are primary divisions of counties and include legal and statistical entities such as minor civil divisions (MCDs), census county divisions (CCDs), census subareas, and unorganized territories (UTs).<br><br>
    `;
      const countySubBoundaryButtonContainer = createButtonWithInfo("Draw County Sub Boundary", "#42A5F5", "#1976D2", "#FFFFFF", "button", countySubBoundaryInfoHtml);
      countySubBoundaryButtonContainer.querySelector("button").addEventListener("click", (event) => {
        event.preventDefault();
        drawBoundary("countysub");
      });
      geoform.appendChild(countySubBoundaryButtonContainer);

      let hrElement1 = document.createElement("hr");
      hrElement1.style.cssText = "margin: 5px 0; border: 0; border-top: 1px solid #ddd;";
      geoform.appendChild(hrElement1);

      let inputContainer = document.createElement("div");
      inputContainer.style.cssText = "display: flex; flex-direction: column; gap: 5px; margin-top: 10px;";

      let colorFontSizeRow = document.createElement("div");
      colorFontSizeRow.style.cssText = "display: flex; justify-content: normal; align-items: center; gap: 0px;";

      let input_color_label = document.createElement("label");
      input_color_label.setAttribute("for", "color");
      input_color_label.innerHTML = "Color: ";
      input_color_label.style.cssText = "font-weight: normal; flex-shrink: 0; margin-right: 5px;";

      let input_color = document.createElement("input");
      input_color.type = "color";
      input_color.id = "color";
      input_color.value = "#00bfff";
      input_color.name = "color";
      input_color.style.cssText = "width: 60px;";

      let input_font_size_label = document.createElement("label");
      input_font_size_label.setAttribute("for", "font_size");
      input_font_size_label.innerHTML = "Font Size: ";
      input_font_size_label.style.cssText = "margin-left: 40px; font-weight: normal; flex-shrink: 0; margin-right: 5px;";

      let input_font_size = document.createElement("input");
      input_font_size.type = "number";
      input_font_size.id = "font_size";
      input_font_size.min = "0";
      input_font_size.max = "20";
      input_font_size.name = "font_size";
      input_font_size.value = "12";
      input_font_size.step = "1.0";
      input_font_size.style.cssText = "width: 50px; text-align: center;";

      colorFontSizeRow.appendChild(input_color_label);
      colorFontSizeRow.appendChild(input_color);
      colorFontSizeRow.appendChild(input_font_size_label);
      colorFontSizeRow.appendChild(input_font_size);
      inputContainer.appendChild(colorFontSizeRow);

      // Row for fill opacity input
      let fillOpacityRow = document.createElement("div");
      fillOpacityRow.style.cssText = `display: flex; flex-direction: column;`;

      // Polygon Fill Opacity
      let input_fill_opacity_label = document.createElement("label");
      input_fill_opacity_label.setAttribute("for", "fill_opacity");
      input_fill_opacity_label.innerHTML = `Fill Opacity % [${(0.05 * 100).toFixed()}]`;
      input_fill_opacity_label.style.cssText = `font-weight: normal;`;

      let input_fill_opacity = document.createElement("input");
      input_fill_opacity.type = "range";
      input_fill_opacity.id = "fill_opacity";
      input_fill_opacity.min = "0";
      input_fill_opacity.max = "1";
      input_fill_opacity.step = "0.01";
      input_fill_opacity.value = "0.05";
      input_fill_opacity.name = "fill_opacity";
      input_fill_opacity.style.cssText = `width: 100%; appearance: none; height: 12px; border-radius: 5px; outline: none;`;

      // Thumb styling via CSS pseudo-elements
      const styleElement = document.createElement("style");
      styleElement.textContent = `
    input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 15px; /* Thumb width */
    height: 15px; /* Thumb height */
    background: #808080; /* Thumb color */
    cursor: pointer; /* Switch cursor to pointer when hovering the thumb */
    border-radius: 50%;
   }
   input[type=range]::-moz-range-thumb {
    width: 15px;
    height: 15px;
    background: #808080;
    cursor: pointer;
    border-radius: 50%;
  }
  input[type=range]::-ms-thumb {
    width: 15px;
    height: 15px;
    background: #808080;
    cursor: pointer;
    border-radius: 50%;
  }
  `;

      document.head.appendChild(styleElement);

      // Initialize with the input color's current value and opacity
      let updateOpacityInputStyles = () => {
        let color = input_color.value;
        let opacityValue = input_fill_opacity.value;
        let rgbaColor = `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, ${opacityValue})`;

        input_fill_opacity.style.backgroundColor = rgbaColor;
        input_fill_opacity.style.border = `2px solid ${color}`;
      };

      updateOpacityInputStyles();

      // Event listener to update the label dynamically
      input_fill_opacity.addEventListener("input", function () {
        input_fill_opacity_label.innerHTML = `Fill Opacity % [${Math.round(this.value * 100)}]`;
        updateOpacityInputStyles();
      });

      // Append elements to the fill opacity row
      fillOpacityRow.appendChild(input_fill_opacity_label);
      fillOpacityRow.appendChild(input_fill_opacity);

      // Append the fill opacity row to the input container
      inputContainer.appendChild(fillOpacityRow);

      // Section for line stroke settings
      let lineStrokeSection = document.createElement("div");
      lineStrokeSection.style.cssText = `display: flex; flex-direction: column; margin-top: 10px;`;

      // Line stroke section label
      let lineStrokeSectionLabel = document.createElement("span");
      lineStrokeSectionLabel.innerText = "Line Stroke Settings:";
      lineStrokeSectionLabel.style.cssText = `font-weight: bold; margin-bottom: 10px;`;
      lineStrokeSection.appendChild(lineStrokeSectionLabel);

      // Line Stroke Size
      let lineStrokeSizeRow = document.createElement("div");
      lineStrokeSizeRow.style.cssText = `display: flex; align-items: center;`;

      let line_stroke_size_label = document.createElement("label");
      line_stroke_size_label.setAttribute("for", "line_size");
      line_stroke_size_label.innerHTML = "Size:";
      line_stroke_size_label.style.cssText = `font-weight: normal; margin-right: 5px;`;

      let line_stroke_size = document.createElement("input");
      line_stroke_size.type = "number";
      line_stroke_size.id = "line_size";
      line_stroke_size.min = "0";
      line_stroke_size.max = "10";
      line_stroke_size.name = "line_size";
      line_stroke_size.value = "1";
      line_stroke_size.step = ".5";
      line_stroke_size.style.cssText = `width: 50px;`;

      lineStrokeSizeRow.appendChild(line_stroke_size_label);
      lineStrokeSizeRow.appendChild(line_stroke_size);
      lineStrokeSection.appendChild(lineStrokeSizeRow);

      // Line Stroke Style
      let lineStrokeStyleRow = document.createElement("div");
      lineStrokeStyleRow.style.cssText = `display: flex; align-items: center; gap: 10px; margin-top: 5px; margin-bottom: 5px;`;

      let line_stroke_types_label = document.createElement("span");
      line_stroke_types_label.innerText = "Style:";
      line_stroke_types_label.style.cssText = `font-weight: normal;`;
      lineStrokeStyleRow.appendChild(line_stroke_types_label);

      let line_stroke_types = [
        { id: "solid", value: "Solid" },
        { id: "dash", value: "Dash" },
        { id: "dot", value: "Dot" },
      ];
      for (const type of line_stroke_types) {
        let radioContainer = document.createElement("div");
        radioContainer.style.cssText = `display: flex; align-items: center; gap: 5px;`;

        let radio = document.createElement("input");
        radio.type = "radio";
        radio.id = type.id;
        radio.value = type.id;
        radio.name = "line_stroke_style";
        radio.style.cssText = `margin: 0; vertical-align: middle;`;

        if (type.id === "solid") {
          radio.checked = true;
        }

        let label = document.createElement("label");
        label.setAttribute("for", radio.id);
        label.innerHTML = type.value;
        label.style.cssText = `font-weight: normal; margin: 0; line-height: 1;`;

        radioContainer.appendChild(radio);
        radioContainer.appendChild(label);

        lineStrokeStyleRow.appendChild(radioContainer);
      }

      lineStrokeSection.appendChild(lineStrokeStyleRow);
      inputContainer.appendChild(lineStrokeSection);

      // Line Stroke Opacity
      let lineStrokeOpacityRow = document.createElement("div");
      lineStrokeOpacityRow.style.cssText = `display: flex; flex-direction: column;`;

      let line_stroke_opacity_label = document.createElement("label");
      line_stroke_opacity_label.setAttribute("for", "line_stroke_opacity");
      line_stroke_opacity_label.innerHTML = "Opacity % [100]";
      line_stroke_opacity_label.style.cssText = `font-weight: normal;`;

      let line_stroke_opacity = document.createElement("input");
      line_stroke_opacity.type = "range";
      line_stroke_opacity.id = "line_stroke_opacity";
      line_stroke_opacity.min = "0";
      line_stroke_opacity.max = "1";
      line_stroke_opacity.step = ".05";
      line_stroke_opacity.value = "1";
      line_stroke_opacity.name = "line_stroke_opacity";
      line_stroke_opacity.style.cssText = `width: 100%; appearance: none; height: 12px; border-radius: 5px; outline: none;`;

      const updateLineOpacityInputStyles = () => {
        let color = input_color.value;
        let opacityValue = line_stroke_opacity.value;
        let rgbaColor = `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, ${opacityValue})`;
        line_stroke_opacity.style.backgroundColor = rgbaColor;
        line_stroke_opacity.style.border = `2px solid ${color}`;
      };

      updateLineOpacityInputStyles();

      line_stroke_opacity.addEventListener("input", function () {
        line_stroke_opacity_label.innerHTML = `Opacity % [${Math.round(this.value * 100)}]`;
        updateLineOpacityInputStyles();
      });

      input_color.addEventListener("input", () => {
        updateLineOpacityInputStyles();
        updateOpacityInputStyles();
      });

      lineStrokeOpacityRow.appendChild(line_stroke_opacity_label);
      lineStrokeOpacityRow.appendChild(line_stroke_opacity);

      // Append the line stroke opacity row to the input container
      inputContainer.appendChild(lineStrokeOpacityRow);

      // Adding a horizontal break before Label Position
      let hrElement2 = document.createElement("hr");
      hrElement2.style.cssText = `margin: 5px 0; border: 0; border-top: 1px solid #ddd;`;
      inputContainer.appendChild(hrElement2);

      // Section for label position
      let labelPositionSection = document.createElement("div");
      labelPositionSection.style.cssText = `display: flex; flex-direction: column;`;

      // Label position section label
      let labelPositionSectionLabel = document.createElement("span");
      labelPositionSectionLabel.innerText = "Label Position Settings:";
      labelPositionSectionLabel.style.cssText = `font-weight: bold; margin-bottom: 5px;`;
      labelPositionSection.appendChild(labelPositionSectionLabel);

      // Container for horizontal and vertical positioning options
      let labelPositionContainer = document.createElement("div");
      labelPositionContainer.style.cssText = `display: flex; margin-left: 10px; gap: 80px;`;

      // Column for horizontal alignment
      let horizontalColumn = document.createElement("div");
      horizontalColumn.style.cssText = `display: flex; flex-direction: column; gap: 5px;`;

      let horizontalLabel = document.createElement("span");
      horizontalLabel.innerText = "Horizontal:";
      horizontalLabel.style.cssText = `font-weight: normal;`;
      horizontalColumn.appendChild(horizontalLabel);

      let label_pos_horizontal = [
        { id: "l", value: "Left" },
        { id: "c", value: "Center" },
        { id: "r", value: "Right" },
      ];
      for (const pos of label_pos_horizontal) {
        let radioHorizontalRow = document.createElement("div");
        radioHorizontalRow.style.cssText = `display: flex; align-items: center; gap: 5px;`;

        let radio = document.createElement("input");
        radio.type = "radio";
        radio.id = pos.id;
        radio.value = pos.id;
        radio.name = "label_pos_horizontal";
        radio.style.cssText = `margin: 0; vertical-align: middle;`;

        let label = document.createElement("label");
        label.setAttribute("for", radio.id);
        label.innerHTML = pos.value;
        label.style.cssText = `font-weight: normal; margin: 0; line-height: 1;`;

        if (radio.id === "c") {
          radio.checked = true;
        }

        radioHorizontalRow.appendChild(radio);
        radioHorizontalRow.appendChild(label);
        horizontalColumn.appendChild(radioHorizontalRow);
      }

      // Column for vertical alignment
      let verticalColumn = document.createElement("div");
      verticalColumn.style.cssText = `display: flex; flex-direction: column; gap: 5px;`;

      let verticalLabel = document.createElement("span");
      verticalLabel.innerText = "Vertical:";
      verticalLabel.style.cssText = `font-weight: normal;`;
      verticalColumn.appendChild(verticalLabel);

      let label_pos_vertical = [
        { id: "t", value: "Top" },
        { id: "m", value: "Middle" },
        { id: "b", value: "Bottom" },
      ];
      for (const pos of label_pos_vertical) {
        let radioVerticalRow = document.createElement("div");
        radioVerticalRow.style.cssText = `display: flex; align-items: center; gap: 5px;`;

        let radio = document.createElement("input");
        radio.type = "radio";
        radio.id = pos.id;
        radio.value = pos.id;
        radio.name = "label_pos_vertical";
        radio.style.cssText = `margin: 0; vertical-align: middle;`;

        let label = document.createElement("label");
        label.setAttribute("for", radio.id);
        label.innerHTML = pos.value;
        label.style.cssText = `font-weight: normal; margin: 0; line-height: 1;`;

        if (radio.id === "m") {
          radio.checked = true;
        }

        radioVerticalRow.appendChild(radio);
        radioVerticalRow.appendChild(label);
        verticalColumn.appendChild(radioVerticalRow);
      }

      // Append columns to the label position container
      labelPositionContainer.appendChild(horizontalColumn);
      labelPositionContainer.appendChild(verticalColumn);
      labelPositionSection.appendChild(labelPositionContainer);
      inputContainer.appendChild(labelPositionSection);
      geoform.appendChild(inputContainer);

      // Adding a horizontal break before the WKT input section
      let hrElement3 = document.createElement("hr");
      hrElement3.style.cssText = `margin: 10px 0; border: 0; border-top: 1px solid #ddd;`; // Adjust margin and border
      geoform.appendChild(hrElement3);

      // New label for the Text Area for WKT input section
      let wktSectionLabel = document.createElement("div");
      wktSectionLabel.innerHTML = 'WKT Input: (<a href="https://en.wikipedia.org/wiki/Well-known_text_representation_of_geometry" target="_blank">WKT Format</a> )';
      wktSectionLabel.style.cssText = `font-weight: bold; margin-bottom: 5px; display: block;`;
      geoform.appendChild(wktSectionLabel);

      // Text Area for WKT input
      let wktContainer = document.createElement("div");
      wktContainer.style.cssText = `display: flex; flex-direction: column; gap: 5px;`;

      // Input for WKT Name
      let input_WKT_name = document.createElement("input");
      input_WKT_name.type = "text";
      input_WKT_name.id = "input_WKT_name";
      input_WKT_name.name = "input_WKT_name";
      input_WKT_name.placeholder = "Name of WKT";
      input_WKT_name.style.cssText = `padding: 8px; font-size: 1rem; border: 2px solid #ddd; border-radius: 5px; width: 100%; box-sizing: border-box;`;
      wktContainer.appendChild(input_WKT_name);

      // Text Area for WKT input
      let input_WKT = document.createElement("textarea");
      input_WKT.id = "input_WKT";
      input_WKT.name = "input_WKT";
      input_WKT.placeholder = "POINT(X Y)  LINESTRING (X Y, X Y,...)  POLYGON(X Y, X Y, X Y,...) etc....";
      input_WKT.style.cssText = `width: 100%; height: 10rem; min-height: 5rem; max-height: 40rem; padding: 8px; font-size: 1rem; border: 2px solid #ddd; border-radius: 5px; box-sizing: border-box; resize: vertical;`;
      // Restrict resizing to vertical
      wktContainer.appendChild(input_WKT);

      // Container for the buttons
      let buttonContainer = document.createElement("div");
      buttonContainer.style.cssText = `display: flex; gap: 45px;`;

      let submit_WKT_btn = createButton("Import WKT", "#8BC34A", "#689F38", "#FFFFFF", "input");
      submit_WKT_btn.id = "submit_WKT_btn";
      submit_WKT_btn.title = "Import WKT Geometry to WME Layer";
      submit_WKT_btn.addEventListener("click", draw_WKT);
      buttonContainer.appendChild(submit_WKT_btn);

      let clear_WKT_btn = createButton("Clear WKT", "#E57373", "#D32F2F", "#FFFFFF", "input");
      clear_WKT_btn.id = "clear_WKT_btn";
      clear_WKT_btn.title = "Clear WKT Geometry Input and Name";
      clear_WKT_btn.addEventListener("click", clear_WKT_input);
      buttonContainer.appendChild(clear_WKT_btn);

      wktContainer.appendChild(buttonContainer);
      geoform.appendChild(wktContainer); // Append the container to the form

      // Add Toggle Button for Debug
      let debugToggleContainer = document.createElement("div");
      debugToggleContainer.style.cssText = `display: flex; align-items: center; margin-top: 15px;`;

      let debugToggleLabel = document.createElement("label");
      debugToggleLabel.style.cssText = `margin-left: 10px;`;

      const updateLabel = () => {
        debugToggleLabel.innerText = `Debug mode ${debug ? "ON" : "OFF"}`;
      };

      let debugSwitchWrapper = document.createElement("label");
      debugSwitchWrapper.style.cssText = `position: relative; display: inline-block; width: 40px; height: 20px; border: 1px solid #ccc; border-radius: 20px;`;

      let debugToggleSwitch = document.createElement("input");
      debugToggleSwitch.type = "checkbox";
      debugToggleSwitch.style.cssText = `opacity: 0; width: 0; height: 0;`;

      let switchSlider = document.createElement("span");
      switchSlider.style.cssText = `position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 20px;`;

      let innerSpan = document.createElement("span");
      innerSpan.style.cssText = `position: absolute; height: 14px; width: 14px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%;`;

      switchSlider.appendChild(innerSpan);

      const updateSwitchState = () => {
        switchSlider.style.backgroundColor = debug ? "#8BC34A" : "#ccc";
        innerSpan.style.transform = debug ? "translateX(20px)" : "translateX(0)";
      };

      debugToggleSwitch.checked = debug;
      updateLabel();
      updateSwitchState();

      debugToggleSwitch.addEventListener("change", () => {
        debug = debugToggleSwitch.checked;
        updateLabel();
        updateSwitchState();
        console.log(`${scriptName}: Debug mode is now ${debug ? "enabled" : "disabled"}`);
      });

      debugSwitchWrapper.appendChild(debugToggleSwitch);
      debugSwitchWrapper.appendChild(switchSlider);
      debugToggleContainer.appendChild(debugSwitchWrapper);
      debugToggleContainer.appendChild(debugToggleLabel);
      geoform.appendChild(debugToggleContainer);

      // Add Toggle Button for forceGeoJSON
      let geoJSONToggleContainer = document.createElement("div");
      geoJSONToggleContainer.style.cssText = `display: flex; align-items: center; margin-top: 10px;`;

      let geoJSONToggleLabel = document.createElement("label");
      geoJSONToggleLabel.style.cssText = `margin-left: 10px;`;

      const updateGeoJSONLabel = () => {
        geoJSONToggleLabel.innerText = `Force GeoJSON Conversion ${forceGeoJSON ? "ON" : "OFF"}`;
      };

      let geoJSONSwitchWrapper = document.createElement("label");
      geoJSONSwitchWrapper.style.cssText = `position: relative; display: inline-block; width: 40px; height: 20px; border: 1px solid #ccc; border-radius: 20px;`;

      let geoJSONToggleSwitch = document.createElement("input");
      geoJSONToggleSwitch.type = "checkbox";
      geoJSONToggleSwitch.style.cssText = `opacity: 0; width: 0; height: 0;`;

      let geoJSONSwitchSlider = document.createElement("span");
      geoJSONSwitchSlider.style.cssText = `position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 20px;`;

      let geoJSONInnerSpan = document.createElement("span");
      geoJSONInnerSpan.style.cssText = `position: absolute; height: 14px; width: 14px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%;`;

      geoJSONSwitchSlider.appendChild(geoJSONInnerSpan);

      const updateGeoJSONSwitchState = () => {
        geoJSONSwitchSlider.style.backgroundColor = forceGeoJSON ? "#8BC34A" : "#ccc";
        geoJSONInnerSpan.style.transform = forceGeoJSON ? "translateX(20px)" : "translateX(0)";
      };

      geoJSONToggleSwitch.checked = forceGeoJSON;
      updateGeoJSONLabel();
      updateGeoJSONSwitchState();

      geoJSONToggleSwitch.addEventListener("change", () => {
        forceGeoJSON = geoJSONToggleSwitch.checked;
        updateGeoJSONLabel();
        updateGeoJSONSwitchState();
        console.log(`${scriptName}: Force GeoJSON Conversion is now ${forceGeoJSON ? "enabled" : "disabled"}`);
        // Trigger map update or reparse data as needed
      });

      geoJSONSwitchWrapper.appendChild(geoJSONToggleSwitch);
      geoJSONSwitchWrapper.appendChild(geoJSONSwitchSlider);
      geoJSONToggleContainer.appendChild(geoJSONSwitchWrapper);
      geoJSONToggleContainer.appendChild(geoJSONToggleLabel);
      geoform.appendChild(geoJSONToggleContainer);

      console.log(`${scriptName}: User Interface Loaded!`);
    });

    setupProjectionsAndTransforms();

    try {
      await initDatabase();
      console.log(`${scriptName}: IndexedDB initialized successfully!`);
      // Now you can safely call functions that use the db
      loadLayers();
    } catch (error) {
      console.error(`${scriptName}: Application Initialization Error:`, error);
    }
  }

  function initDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("GeometryLayersDB", 1);

      request.onupgradeneeded = function (event) {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("layers")) {
          db.createObjectStore("layers", { keyPath: "filename" });
        }
      };

      request.onsuccess = function (event) {
        db = event.target.result;
        resolve();
      };

      request.onerror = function (event) {
        console.error("Failed to open IndexedDB:", event.target.error);
        reject(new Error("IndexedDB initialization failed"));
      };
    });
  }

  /**
   * Initializes and registers coordinate reference systems (CRS) and their transformations in OpenLayers using Proj4.
   * This setup enhances map accuracy and interoperability by ensuring a wide range of projections are available and correctly linked.
   *
   * Function details:
   * 1. **Library Check**: Ensures that both OpenLayers and Proj4js libraries are available for use. Logs an error if any is missing.
   *
   * 2. **Projection Definition**:
   *    - Lists proj4-compatible string definitions for numerous EPSG codes, covering global systems like WGS84 and national systems.
   *    - Each EPSG code is associated with additional properties like `units` and `maxExtent`, which define the coordinate system's domain and measurement unit.
   *
   * 3. **UTM Zones Registration**:
   *    - Automatically constructs and registers UTM zone projections for both the northern and southern hemispheres (EPSG:326xx and EPSG:327xx).
   *
   * 4. **Projection Registration**:
   *    - Registers each defined projection in proj4 and OpenLayers to make them available for use within OpenLayers maps.
   *    - Establishes transformation functions between each newly defined projection and base Web Mercator projections (EPSG:900913 and EPSG:3857).
   *
   * 5. **Debugging and Logging**:
   *    - Provides extensive logging for debugging purposes, displaying registered projections and transformations if debugging is enabled.
   *
   * 6. **Projection Aliases**:
   *    - Populates a `projectionMap` with common identifiers and their OpenLayers Projection objects to facilitate easy reference to projections by various aliases.
   *
   * 7. **Flexible Identifier Mapping**:
   *    - Uses a template-based mechanism to generate and register multiple alias forms for each EPSG projection.
   *
   * Notes:
   * - Provides a comprehensive base for geographic applications needing diverse coordinate system support.
   * - Alerts or logs errors when prerequisites are unmet or issues arise during the setup.
   *
   * Ensure this function runs at initialization to make all defined projections and transformations instantly available across your mapping application.
   */
  function setupProjectionsAndTransforms() {
    /********************  Register missing transformations in OpenLayers using proj4!  ************************
     * The `globals` function initializes commonly used coordinate reference system (CRS) definitions
     * using Proj4. These definitions include several standard EPSG codes, which are referenced globally.
     * The function also sets global shortcuts for these systems, such as WGS84 referencing EPSG:4326.
     */

    // Ensure Proj4js is loaded along with OpenLayers
    if (typeof OpenLayers !== "undefined" && typeof proj4 !== "undefined") {
      OpenLayers.Projection.prototype.proj4js = proj4;
      console.log(`${scriptName}: OpenLayers and Proj4js are properly integrated.`);
    } else {
      console.error(`${scriptName}: Required libraries OpenLayers and/or Proj4js are not loaded.`);
      return;
    }

    // Define projection mappings with additional properties needed to create OpenLayers projections (units: , maxExtent: yx:)
    //definition: should be in proj4js format
    const projDefs = {
      "EPSG:4326": { definition: "+title=WGS 84 (long/lat) +proj=longlat +ellps=WGS84 +datum=WGS84 +units=degrees", maxExtent: [-180, -90, 180, 90], units: "degrees", yx: true },
      "EPSG:3857": { definition: "+title=WGS 84 / Pseudo-Mercator +proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +no_defs", maxExtent: [-20037508.34, -20037508.34, 20037508.34, 20037508.34], units: "m" },
      "EPSG:900913": { definition: "+title=WGS 84 / Pseudo-Mercator +proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +no_defs", maxExtent: [-20037508.34, -20037508.34, 20037508.34, 20037508.34], units: "m" },
      "EPSG:102100": { definition: "+title=WGS 84 / Pseudo-Mercator +proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +no_defs", maxExtent: [-20037508.34, -20037508.34, 20037508.34, 20037508.34], units: "m" },
      "EPSG:4269": { definition: "+title=NAD83 (long/lat) +proj=longlat +a=6378137.0 +b=6356752.31414036 +ellps=GRS80 +datum=NAD83 +units=degrees", maxExtent: [-179.999, -4.999, 179.999, 49.999], units: "degrees" },
      "EPSG:4267": { definition: "+title=NAD27 +proj=longlat +ellps=clrk66 +datum=NAD27 +no_defs", maxExtent: [-179.999, -4.999, 179.999, 49.999], units: "degrees" },
      "EPSG:3035": { definition: "+title=ETRS89-extended / LAEA Europe +proj=laea +lat_0=52 +lon_0=10 +x_0=4321000 +y_0=3210000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs", maxExtent: [-4281778.7, 4351889.4, 1100517.0, 8509999.2], units: "m" },
      "EPSG:4258": { definition: "+title=ETRS89 (European Terrestrial Reference System 1989 +proj=longlat +ellps=GRS80 +no_defs +type=crs", maxExtent: [-16.1, 33.26, 38.01, 84.73], units: "degrees" },
      "EPSG:25832": { definition: "+title=ETRS89 / UTM zone 32N +proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs", maxExtent: [-1866822.47, 3680224.65, 3246120.36, 9483069.2], units: "m" },
      "EPSG:27700": { definition: "+title=OSGB36 / British National Grid +proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.060 +units=m +no_defs", maxExtent: [-68652.35, -16703.89, 652865.25, 3659.81], units: "m" },
      "EPSG:4283": { definition: "+title=GDA94 / Geocentric Datum of Australia 1994 +proj=longlat +ellps=GRS80 +no_defs +type=crs", maxExtent: [93.41, -60.55, 173.34, -8.47], units: "degrees" },
      "EPSG:4214": { definition: "+title=Beijing 1954 +proj=longlat +ellps=krass +towgs84=15.8,-154.4,-82.3,0,0,0,0 +no_defs +type=crs", maxExtent: [73.62, 16.7, 134.77, 53.56], units: "degrees" },
      "EPSG:3414": { definition: "+title=SVY21 / Singapore TM +proj=tmerc +lat_0=1.36666666666667 +lon_0=103.833333333333 +k=1 +x_0=28001.642 +y_0=38744.572 +ellps=WGS84 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs", maxExtent: [919.05, 12575.2, 54342.24, 5012.13], units: "m" },
      // NAD 83 and by Zone
      "EPSG:26901": { definition: "+title=NAD83 / UTM zone 1N +proj=utm +zone=1 +ellps=GRS80 +towgs84=-2,0,4,0,0,0,0 +units=m +no_defs +type=crs", maxExtent: [-236664.12, 5683214.12, 1346321.23, 6089777.96], units: "m" },
      "EPSG:26902": { definition: "+title=NAD83 / UTM zone 2N +proj=utm +zone=2 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs", maxExtent: [343123.02, 2634042.41, 10385020.37, 15684396.61], units: "m" },
      "EPSG:26903": { definition: "+title=NAD83 / UTM zone 3N +proj=utm +zone=3 +ellps=GRS80 +towgs84=-2,0,4,0,0,0,0 +units=m +no_defs +type=crs", maxExtent: [-269529.98, 2634442.81, 10381806.16, 15110676.33], units: "m" },
      "EPSG:26904": { definition: "+title=NAD83 / UTM zone 4N +proj=utm +zone=4 +ellps=GRS80 +towgs84=-2,0,4,0,0,0,0 +units=m +no_defs +type=crs", maxExtent: [-887933.72, 2634920.25, 10377477.4, 14363875.02], units: "m" },
      "EPSG:26905": { definition: "+title=NAD83 / UTM zone 5N +proj=utm +zone=5 +ellps=GRS80 +towgs84=-2,0,4,0,0,0,0 +units=m +no_defs +type=crs", maxExtent: [-1516761.97, 2635474.79, 10372038.07, 13402280.66], units: "m" },
      "EPSG:26906": { definition: "+title=NAD83 / UTM zone 6N +proj=utm +zone=6 +ellps=GRS80 +towgs84=-2,0,4,0,0,0,0 +units=m +no_defs +type=crs", maxExtent: [-2160832.29, 2636054.6, 10365493.19, 12204094.4], units: "m" },
      "EPSG:26907": { definition: "+title=NAD83 / UTM zone 7N +proj=utm +zone=7 +ellps=GRS80 +towgs84=-2,0,4,0,0,0,0 +units=m +no_defs +type=crs", maxExtent: [-2825105.32, 2635428.89, 10357848.76, 10804497.54], units: "m" },
      "EPSG:26908": { definition: "+title=NAD83 / UTM zone 8N +proj=utm +zone=8 +ellps=GRS80 +towgs84=-2,0,4,0,0,0,0 +units=m +no_defs +type=crs", maxExtent: [-3514571.4, 2634880.35, 10349111.76, 9979047.26], units: "m" },
      "EPSG:26909": { definition: "+title=NAD83 / UTM zone 9N +proj=utm +zone=9 +ellps=GRS80 +towgs84=-2,0,4,0,0,0,0 +units=m +no_defs +type=crs", maxExtent: [-4233900.32, 2634408.91, 10009187.77, 9937834.11], units: "m" },
      "EPSG:26910": { definition: "+title=NAD83 / UTM zone 10N +proj=utm +zone=10 +ellps=GRS80 +towgs84=-2,0,4,0,0,0,0 +units=m +no_defs +type=crs", maxExtent: [-4986601.04, 2634014.5, 9400376.54, 9897284.61], units: "m" },
      "EPSG:26911": { definition: "+title=NAD83 / UTM zone 11N +proj=utm +zone=11 +ellps=GRS80 +towgs84=-2,0,4,0,0,0,0 +units=m +no_defs +type=crs", maxExtent: [-5773188.31, 2633697.07, 8640663.91, 9857845.83], units: "m" },
      "EPSG:26912": { definition: "+title=NAD83 / UTM zone 12N +proj=utm +zone=12 +ellps=GRS80 +towgs84=-2,0,4,0,0,0,0 +units=m +no_defs +type=crs", maxExtent: [-6587424.26, 2633456.58, 7823629.61, 9819951.93], units: "m" },
      "EPSG:26913": { definition: "+title=NAD83 / UTM zone 13N +proj=utm +zone=13 +ellps=GRS80 +towgs84=-2,0,4,0,0,0,0 +units=m +no_defs +type=crs", maxExtent: [-7409211.34, 2633293.0, 7004315.28, 9846806.33], units: "m" },
      "EPSG:26914": { definition: "+title=NAD83 / UTM zone 14N +proj=utm +zone=14 +ellps=GRS80 +towgs84=-2,0,4,0,0,0,0 +units=m +no_defs +type=crs", maxExtent: [-8193186.78, 2633206.3, 6208726.29, 9885845.94], units: "m" },
      "EPSG:26915": { definition: "+title=NAD83 / UTM zone 15N +proj=utm +zone=15 +ellps=GRS80 +towgs84=-2,0,4,0,0,0,0 +units=m +no_defs +type=crs", maxExtent: [-8856933.09, 2633196.48, 5446161.06, 9926122.27], units: "m" },
      "EPSG:26916": { definition: "+title=NAD83 / UTM zone 16N +proj=utm +zone=16 +ellps=GRS80 +towgs84=-2,0,4,0,0,0,0 +units=m +no_defs +type=crs", maxExtent: [-9285588.45, 2633263.53, 4717539.4, 9967191.44], units: "m" },
      "EPSG:26917": { definition: "+title=NAD83 / UTM zone 17N +proj=utm +zone=17 +ellps=GRS80 +towgs84=-2,0,4,0,0,0,0 +units=m +no_defs +type=crs", maxExtent: [-9375787.46, 2633407.46, 4019960.94, 10380625.27], units: "m" },
      "EPSG:26918": { definition: "+title=NAD83 / UTM zone 18N +proj=utm +zone=18 +ellps=GRS80 +towgs84=-2,0,4,0,0,0,0 +units=m +no_defs +type=crs", maxExtent: [-9369979.01, 2633628.29, 3348971.56, 11819889.87], units: "m" },
      "EPSG:26919": { definition: "+title=NAD83 / UTM zone 19N +proj=utm +zone=19 +ellps=GRS80 +towgs84=-2,0,4,0,0,0,0 +units=m +no_defs +type=crs", maxExtent: [-9363066.9, 2633926.06, 2699621.82, 13082867.02], units: "m" },
      "EPSG:26920": { definition: "+title=NAD83 / UTM zone 20N +proj=utm +zone=20 +ellps=GRS80 +towgs84=-2,0,4,0,0,0,0 +units=m +no_defs +type=crs", maxExtent: [-9355057.45, 2634300.79, 2066923.68, 14111784.79], units: "m" },
      "EPSG:26921": { definition: "+title=NAD83 / UTM zone 21N +proj=utm +zone=21 +ellps=GRS80 +towgs84=-2,0,4,0,0,0,0 +units=m +no_defs +type=crs", maxExtent: [-9346704.62, 2634752.54, 1446015.08, 14916202.24], units: "m" },
      "EPSG:26922": { definition: "+title=NAD83 / UTM zone 22N +proj=utm +zone=22 +ellps=GRS80 +towgs84=-2,0,4,0,0,0,0 +units=m +no_defs +type=crs", maxExtent: [-9355719.6, 2635281.37, 832184.74, 15535142.11], units: "m" },
      "EPSG:26923": { definition: "+title=NAD83 / UTM zone 23N +proj=utm +zone=23 +ellps=GRS80 +towgs84=-2,0,4,0,0,0,0 +units=m +no_defs +type=crs", maxExtent: [-9363643.95, 2635887.35, 481118.3, 16010435.63], units: "m" },
    };

    // Add WGS 84 UTM Zones - Global UTM zones covering various longitudes for both hemispheres
    for (let zone = 1; zone <= 60; zone++) {
      projDefs[`EPSG:${32600 + zone}`] = {
        definition: `+proj=utm +zone=${zone} +datum=WGS84 +units=m +no_defs`,
        units: "m",
        maxExtent: [166021.44, 0, 833978.56, 9329005.18],
      };
      projDefs[`EPSG:${32700 + zone}`] = {
        definition: `+proj=utm +zone=${zone} +south +datum=WGS84 +units=m +no_defs`,
        units: "m",
        maxExtent: [166021.44, 1116915.04, 833978.56, 10000000.0],
      };
    }

    // Register the projections manually
    for (const [epsg, { definition, units, maxExtent, yx }] of Object.entries(projDefs)) {
      proj4.defs(epsg, definition); // Register each one with proj4
      OpenLayers.Projection.defaults[epsg] = { units, maxExtent, yx }; // Add each one to the list of defult avalaible projections in open layers
    }

    // Function to add only the necessary transformation from UTM to supported formats
    function addProjTransform(fromEPSG, toEPSG) {
      OpenLayers.Projection.addTransform(fromEPSG, toEPSG, function (point) {
        const transformedPoint = proj4(fromEPSG, toEPSG, [point.x, point.y]);
        point.x = transformedPoint[0];
        point.y = transformedPoint[1];
        return point;
      });
    }

    // Base internal projections EPSGs for WME to transform to
    const baseEPSGs = ["EPSG:900913", "EPSG:3857"];

    // Dynamically prepare a list from all defined projection keys
    const allEPSGs = Object.keys(projDefs);

    // Register transformations for all defined EPSGs in open layers
    for (const srcEPSG of allEPSGs) {
      for (const tgtEPSG of baseEPSGs) {
        addProjTransform(srcEPSG, tgtEPSG);
      }
    }

    // Optional debugging information
    if (debug) {
      console.log(`${scriptName}: OpenLayers.Projection.defaults:`, OpenLayers.Projection.defaults);

      const definedProjections = {};
      Object.keys(proj4.defs).forEach((code) => {
        try {
          const definition = proj4.defs(code);
          definedProjections[code] = definition;
        } catch (error) {
          console.warn(`${scriptName}: Could not retrieve definition for ${code}: ${error.message}`);
        }
      });

      if (debug) console.log(`${scriptName}: OpenLayers.Projection.transforms:`, OpenLayers.Projection.transforms);
      if (debug) testTransformations();
    }

    // Create a mapping of common EPSG codes and common aliases to their OpenLayers Projection objects
    projectionMap = {
      // WGS84 common aliases, same as ESPG:4326
      CRS84: new OpenLayers.Projection("EPSG:4326"),
      "urn:ogc:def:crs:OGC:1.3:CRS84": new OpenLayers.Projection("EPSG:4326"),
      WGS84: new OpenLayers.Projection("EPSG:4326"),
      "urn:ogc:def:crs:OGC:1.3:WGS84": new OpenLayers.Projection("EPSG:4326"),
      "WGS 84": new OpenLayers.Projection("EPSG:4326"),
      "urn:ogc:def:crs:OGC:1.3:WGS_84": new OpenLayers.Projection("EPSG:4326"),
      "CRS WGS84": new OpenLayers.Projection("EPSG:4326"),
      "urn:ogc:def:crs:OGC:1.3:CRS_WGS84": new OpenLayers.Projection("EPSG:4326"),
      "CRS:WGS84": new OpenLayers.Projection("EPSG:4326"),
      "urn:ogc:def:crs:OGC:1.3:CRS:WGS84": new OpenLayers.Projection("EPSG:4326"),
      "CRS::WGS84": new OpenLayers.Projection("EPSG:4326"),
      "urn:ogc:def:crs:OGC:1.3:CRS::WGS84": new OpenLayers.Projection("EPSG:4326"),
      "CRS:84": new OpenLayers.Projection("EPSG:4326"),
      "urn:ogc:def:crs:OGC:1.3:CRS:84": new OpenLayers.Projection("EPSG:4326"),
      "CRS::84": new OpenLayers.Projection("EPSG:4326"),
      "urn:ogc:def:crs:OGC:1.3:CRS::84": new OpenLayers.Projection("EPSG:4326"),
      "CRS 84": new OpenLayers.Projection("EPSG:4326"),
      "urn:ogc:def:crs:OGC:1.3:CRS_84": new OpenLayers.Projection("EPSG:4326"),
      // ESPG:4269 NAD 83 common aliases
      "NAD 83": new OpenLayers.Projection("EPSG:4269"),
      "urn:ogc:def:crs:OGC:1.3:NAD_83": new OpenLayers.Projection("EPSG:4269"),
      NAD83: new OpenLayers.Projection("EPSG:4269"),
      "urn:ogc:def:crs:OGC:1.3:NAD83": new OpenLayers.Projection("EPSG:4269"),
      //ESPG:3035  ETRS89 / LAEA Europe and it's common aliases
      "ETRS 89": new OpenLayers.Projection("EPSG:3035"),
      "urn:ogc:def:crs:OGC:1.3:ETRS_89": new OpenLayers.Projection("EPSG:3035"),
      ETRS89: new OpenLayers.Projection("EPSG:3035"),
      "urn:ogc:def:crs:OGC:1.3:ETRS89": new OpenLayers.Projection("EPSG:3035"),
      //ESPG:4267  ETRS89 / LAEA Europe common aliases
      "NAD 27": new OpenLayers.Projection("EPSG:4267"),
      "urn:ogc:def:crs:OGC:1.3:NAD_27": new OpenLayers.Projection("EPSG:4267"),
      NAD27: new OpenLayers.Projection("EPSG:4267"),
      "urn:ogc:def:crs:OGC:1.3:NAD27": new OpenLayers.Projection("EPSG:4267"),
    };

    const identifierTemplates = [
      "EPSG:{{code}}",
      "urn:ogc:def:crs:EPSG:{{code}}",
      "urn:ogc:def:crs:OGC:1.3:EPSG:{{code}}",
      "EPSG::{{code}}",
      "urn:ogc:def:crs:EPSG::{{code}}",
      "urn:ogc:def:crs:OGC:1.3:EPSG::{{code}}",
      "CRS:{{code}}",
      "urn:ogc:def:crs:OGC:1.3:CRS:{{code}}",
      "CRS::{{code}}",
      "urn:ogc:def:crs:OGC:1.3:CRS::{{code}}",
      "CRS {{code}}",
      "urn:ogc:def:crs:OGC:1.3:CRS_{{code}}",
      "CRS{{code}}",
      "urn:ogc:def:crs:OGC:1.3:CRS{{code}}",
    ];

    // Extract EPSG codes from the projDefs object
    const epsgCodes = Object.keys(projDefs).map((key) => key.split(":")[1]);

    // Use a loop to populate the projectionMap object
    epsgCodes.forEach((code) => {
      identifierTemplates.forEach((template) => {
        const identifier = template.replace("{{code}}", code);
        projectionMap[identifier] = new OpenLayers.Projection(`EPSG:${code}`);
      });
    });

    if (debug) console.log(`${scriptName}: projectionMap:`, projectionMap);
  }

  /****************************************************************************
   * draw_WKT
   *
   * Description:
   * Parses user-supplied Well-Known Text (WKT) to create a geometric layer on the map using the wicket.js library for
   * reliable parsing. This function configures the layer with user-defined styling options and ensures the layer is
   * stored and displayed appropriately.
   *
   * Parameters:
   * - No explicit parameters are passed; all input is taken from DOM elements configured by the user.
   *
   * Behavior:
   * - Retrieves styling options and WKT input from predefined HTML elements.
   * - Checks for duplicate layer names to prevent adding layers with the same name to the map.
   * - Validates the presence of WKT input and handles errors related to parsing and conversion to GeoJSON format.
   * - Constructs a `layerStoreObj` containing the parsed GeoJSON data and its styling details.
   * - Uses `parseFile` to add the parsed and styled layer to the map.
   * - Compresses and stores the layer information in `localStorage` for persistence.
   * - Provides users with real-time feedback via console logs and alerts when debug mode is enabled or when errors arise.
   *
   * Notes:
   * - Utilizes global variables and functions such as `formats`, `storedLayers`, and `parseFile`.
   * - Relies on DOM elements and user inputs that need to be correctly set up in the environment for this function to work.
   *****************************************************************************/

  function draw_WKT() {
    // Retrieve style and layer options
    let color = document.getElementById("color").value;
    let fillOpacity = document.getElementById("fill_opacity").value;
    let fontsize = document.getElementById("font_size").value;
    let lineopacity = document.getElementById("line_stroke_opacity").value;
    let linesize = document.getElementById("line_size").value;
    let linestyle = document.querySelector('input[name="line_stroke_style"]:checked').value;
    let layerName = document.getElementById("input_WKT_name").value.trim();
    let labelpos = document.querySelector('input[name="label_pos_horizontal"]:checked').value + document.querySelector('input[name="label_pos_vertical"]:checked').value;

    // Check for empty layer name
    if (!layerName) {
      if (debug) console.error(`${scriptName}: WKT Input layer name cannot be empty.`);
      WazeWrap.Alerts.error(scriptName, "WKT Input layer name cannot be empty.");
      return;
    }

    // Check for duplicate layer name
    let layers = W.map.getLayersBy("layerGroup", "wme_geometry");
    for (let i = 0; i < layers.length; i++) {
      if (layers[i].name === "Geometry: " + layerName) {
        if (debug) console.error(`${scriptName}: Current WKT layer name already used`);
        WazeWrap.Alerts.error(scriptName, "Current layer name already used!");
        return;
      }
    }

    // Retrieve and validate WKT input
    let wktInput = document.getElementById("input_WKT").value.trim();
    if (!wktInput) {
      if (debug) console.error(`${scriptName}: WKT input is empty.`);
      WazeWrap.Alerts.error(scriptName, "WKT input is empty.");
      return;
    }

    try {
      // Create an instance of GeoWKTer
      const geoWKTer = new GeoWKTer();
      const wktString = geoWKTer.read(wktInput, layerName); // Parse WKT input to an internal representation
      const geojson = geoWKTer.toGeoJSON(wktString); // Convert to GeoJSON using the toGeoJSON method
      // Store and add the GeoJSON layer
      const obj = new layerStoreObj(geojson, color, "GEOJSON", layerName, fillOpacity, fontsize, lineopacity, linesize, linestyle, labelpos, "${Name}", "WKT");
      parseFile(obj);
    } catch (error) {
      console.error(`${scriptName}: Error processing WKT input`, error);
      WazeWrap.Alerts.error(scriptName, `Error processing WKT input. Please check your input format.\n${error.message}`);
    }
  }

  // Clears the current contents of the textarea.
  function clear_WKT_input() {
    document.getElementById("input_WKT").value = "";
    document.getElementById("input_WKT_name").value = "";
  }

  /**
   * Draws the boundary of a geographical region (state, county, or CountySub) using ArcGIS data and user-defined
   * formatting options. Retrieves and parses geographical data, applies specified styling, and checks for existing layers
   * to prevent duplicating the visualization on the map. Alerts are shown for operations and error handling.
   *
   * @param {string} item - A descriptor indicating the type of boundary to be drawn (e.g., "State", "County", "CountySub").
   *
   * Function workflow:
   * 1. Collects styling options from HTML form elements, which include color, opacity, font size, line styles, and label positions.
   * 2. Utilizes `getArcGISdata` to fetch the GeoJSON representation of the specified boundary.
   * 3. Validates the fetched data to ensure features exist. If none are found, alerts the user.
   * 4. Checks the map for existing boundary visualizations to avoid duplicating them.
   * 5. If a valid and non-duplicate boundary is identified:
   *    a. Constructs a new `layerStoreObj` using the fetched GeoJSON data and the user-defined styling options.
   *    b. Calls `parseFile` to render the boundary onto the map.
   * 6. Logs messages and displays alerts about the success of the operation, duplicate layers, and any data retrieval errors.
   *
   * Error Handling:
   * - Logs errors to the console and displays alerts for data retrieval issues from the GIS service.
   * - Notifies the user if the retrieved data does not contain any features.
   * - Alerts on attempts to render already loaded boundaries.
   */
  function drawBoundary(item) {
    // Add formating options and local storage for WME refresh availability to Draw State Boundary functionality
    let color = document.getElementById("color").value;
    let fillOpacity = document.getElementById("fill_opacity").value;
    let fontsize = document.getElementById("font_size").value;
    let lineopacity = document.getElementById("line_stroke_opacity").value;
    let linesize = document.getElementById("line_size").value;
    let linestyle = document.querySelector('input[name="line_stroke_style"]:checked').value;
    let labelpos = document.querySelector('input[name="label_pos_horizontal"]:checked').value + document.querySelector('input[name="label_pos_vertical"]:checked').value;

    // Assuming that the state boundary is what you want to draw
    getArcGISdata(item)
      .then((geojson) => {
        if (!geojson || !geojson.features || geojson.features.length === 0) {
          console.log("Error: No features found.");
          WazeWrap.Alerts.info(scriptName, "No State Boundary Available, Sorry!");
          return;
        }

        // Extract the first feature, assuming that's the desired state boundary for simplicity
        const Feature = geojson.features[0];
        const layerName = Feature.properties.NAME;

        // Check if the layer already exists
        let layers = W.map.getLayersBy("layerGroup", "wme_geometry");
        for (let layer of layers) {
          if (layer.name === "Geometry: " + layerName) {
            if (debug) console.log(`${scriptName}: current ${item} already loaded`);
            WazeWrap.Alerts.info(scriptName, `Current ${item} Boundary already Loaded!`);
            return;
          }
        }

        // Create a new layer object
        let obj = new layerStoreObj(geojson, color, "GEOJSON", layerName, fillOpacity, fontsize, lineopacity, linesize, linestyle, labelpos, "${NAME}", "GEOJSON");

        parseFile(obj);
      })
      .catch((error) => {
        console.error(`${scriptName}: Failed to retrieve ${item} boundary:`, error);
        WazeWrap.Alerts.error(scriptName, `Failed to retrieve ${item} boundary.`);
      });
  }

  /*************************************************************************
   * addGeometryLayer
   *
   * Description:
   * Facilitates the addition of a new geometry layer to the map by reading a user-selected file, parsing its contents,
   * and configuring the layer with specified styling options. The function also updates UI elements and handles storage
   * of the layer information.
   *
   * Process:
   * - Captures a file from a user's file input and determines its extension and name.
   * - Collects styling and configuration options from the user interface through DOM elements.
   * - Validates user-selected file format against supported formats, handling any unsupported formats with an error message.
   * - Leverages a `FileReader` to asynchronously read the file's contents and creates a `fileObj`.
   * - Calls `parseFile` to interpret `fileObj`, creating and configuring the geometry layers on the map.
   * - Updates persistent storage with compressed data to save the state of added geometrical layers.
   *
   * Notes:
   * - Operates within a larger system context, relying on global variables such as `formats` for file format validation.
   *************************************************************************/

  function addGeometryLayer() {
    toggleParsingMessage(true); // turn off in parseFile()

    const fileList = document.getElementById("GeometryFile");
    const file = fileList.files[0];
    fileList.value = "";

    const fileName = file.name;
    const lastDotIndex = fileName.lastIndexOf(".");

    const fileext = lastDotIndex !== -1 ? fileName.substring(lastDotIndex + 1).toUpperCase() : "";
    const filename = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;

    // Collect configuration options from UI
    const color = document.getElementById("color").value;
    const fillOpacity = document.getElementById("fill_opacity").value;
    const fontsize = document.getElementById("font_size").value;
    const lineopacity = document.getElementById("line_stroke_opacity").value;
    const linesize = document.getElementById("line_size").value;
    const linestyle = document.querySelector('input[name="line_stroke_style"]:checked').value;
    const labelpos = document.querySelector('input[name="label_pos_horizontal"]:checked').value + document.querySelector('input[name="label_pos_vertical"]:checked').value;

    const reader = new FileReader();

    reader.onload = function (e) {
      requestAnimationFrame(() => {
        try {
          let fileObj;

          switch (fileext) {
            case "ZIP":
              if (debug) console.log(`${scriptName}: .ZIP shapefile file found, format not supported by OpenLayers v 2.13.1, converting to GEOJSON...`);
              if (debug) console.time(`${scriptName}: .ZIP shapefile conversion in`);

              const geoSHPer = new GeoSHPer();

              // Using an IIFE to handle the async operation with try/catch
              (async () => {
                try {
                  toggleParsingMessage(true); // Show the parsing message at the start

                  // Ensure the operation is awaited
                  await geoSHPer.read(e.target.result);
                  const geoJSON = geoSHPer.toGeoJSON();
                  const geojsonWithoutZ = removeZCoordinates(geoJSON); // Current WME Open Layers 2.13.1 geoJSON parser does not support z and or M

                  if (debug) console.timeEnd(`${scriptName}: .ZIP shapefile conversion in`);

                  const fileObj = new layerStoreObj(geojsonWithoutZ, color, "GEOJSON", filename, fillOpacity, fontsize, lineopacity, linesize, linestyle, labelpos, "", "SHP");

                  parseFile(fileObj);
                } catch (error) {
                  toggleParsingMessage(false);
                  handleError("ZIP shapefile")(error);
                }
              })();
              break;

            case "WKT":
              try {
                if (forceGeoJSON) {
                  // WKT files are assumed to be in projection WGS84  = EPSG:4326
                  if (debug) console.log(`${scriptName}: .WKT file found, forceGeoJSON is ON, converting to GEOJSON...`);
                  if (debug) console.time(`${scriptName}: .WKT conversion in`);

                  const geoWKTer = new GeoWKTer();
                  const wktDoc = geoWKTer.read(e.target.result, filename); // Read entire content as a single WKT input
                  const geoJSON = geoWKTer.toGeoJSON(wktDoc);

                  if (debug) console.timeEnd(`${scriptName}: .WKT conversion in`);

                  fileObj = new layerStoreObj(geoJSON, color, "GEOJSON", filename, fillOpacity, fontsize, lineopacity, linesize, linestyle, labelpos, "", fileext);
                } else {
                  if (debug) console.log(`${scriptName}: .WKT file found, forceGeoJSON is OFF.... passing to OpenLayers...`);
                  fileObj = new layerStoreObj(e.target.result, color, fileext, filename, fillOpacity, fontsize, lineopacity, linesize, linestyle, labelpos, "", fileext);
                }
                parseFile(fileObj);
              } catch (error) {
                toggleParsingMessage(false);
                handleError("WKT conversion")(error);
              }
              break;

            case "GPX":
              //The GPX format is inherently based on the WGS 84 coordinate system (EPSG:4326) using latitude and longitude.
              try {
                if (forceGeoJSON) {
                  if (debug) console.log(`${scriptName}: .GPX file found, forceGeoJSON is ON.... converting to GEOJSON...`);
                  if (debug) console.time(`${scriptName}: .GPX conversion in`);

                  const geoGPXer = new GeoGPXer();
                  const gpxDoc = geoGPXer.read(e.target.result);
                  const GPXtoGeoJSON = geoGPXer.toGeoJSON(gpxDoc);

                  if (debug) console.timeEnd(`${scriptName}: .GPX conversion in`);

                  fileObj = new layerStoreObj(GPXtoGeoJSON, color, "GEOJSON", filename, fillOpacity, fontsize, lineopacity, linesize, linestyle, labelpos, "", fileext);
                } else {
                  if (debug) console.log(`${scriptName}: .GPX file found, forceGeoJSON is OFF.... passing to OpenLayers...`);
                  fileObj = new layerStoreObj(e.target.result, color, fileext, filename, fillOpacity, fontsize, lineopacity, linesize, linestyle, labelpos, "", fileext);
                }

                parseFile(fileObj);
              } catch (error) {
                toggleParsingMessage(false);
                handleError("KML conversion")(error);
              }
              break;

            case "KML":
              //Represent geographic data and are natively based on the WGS 84 coordinate system (EPSG:4326), using latitude and longitude.
              try {
                if (forceGeoJSON) {
                  if (debug) console.log(`${scriptName}: .KML file found, forceGeoJSON is ON.... converting to GEOJSON...`);
                  if (debug) console.time(`${scriptName}: .KML conversion in`);

                  const geoKMLer = new GeoKMLer(); // Currently only extrancts X & Y, when updated for Z will need to add removeZCoordinates() on the output for OL 2.13.1 GeoJSON parser.
                  const kmlDoc = geoKMLer.read(e.target.result);
                  const KMLtoGeoJSON = geoKMLer.toGeoJSON(kmlDoc, true);
                  const geojsonWithoutZ = removeZCoordinates(KMLtoGeoJSON); // Current WME Open Layers 2.13.1 geoJSON parser does not support z and or M
                  
                  if (debug) console.timeEnd(`${scriptName}: .KML conversion in`);

                  fileObj = new layerStoreObj(geojsonWithoutZ, color, "GEOJSON", filename, fillOpacity, fontsize, lineopacity, linesize, linestyle, labelpos, "", fileext);
                } else {
                  if (debug) console.log(`${scriptName}: .KML file found, forceGeoJSON is OFF.... passing to OpenLayers...`);
                  fileObj = new layerStoreObj(e.target.result, color, fileext, filename, fillOpacity, fontsize, lineopacity, linesize, linestyle, labelpos, "", fileext);
                }

                parseFile(fileObj);
              } catch (error) {
                toggleParsingMessage(false);
                handleError("KML conversion")(error);
              }
              break;

            case "KMZ":
              if (debug) console.log(`${scriptName}: .KMZ file found, forceGeoJSON is ON.... converting to GEOJSON...`);
              if (debug) console.time(`${scriptName}: .KMZ conversion in`);
              // Initialize the GeoKMZer instance
              const geoKMZer = new GeoKMZer();

              (async () => {
                try {
                  // Read and parse the KMZ file
                  const kmlContentsArray = await geoKMZer.read(e.target.result);

                  // Iterate over each KML file extracted from the KMZ
                  kmlContentsArray.forEach(({ filename: kmlFile, content }, index) => {
                    // Construct unique filenames for each KML file
                    const uniqueFilename = kmlContentsArray.length > 1 ? `${filename}_${index + 1}` : `${filename}`;

                    if (forceGeoJSON) {
                      if (debug) console.log(`${scriptName}: Converting extracted .KML to GEOJSON...`);

                      const geoKMLer = new GeoKMLer();
                      const kmlDoc = geoKMLer.read(content);
                      const KMLtoGeoJSON = geoKMLer.toGeoJSON(kmlDoc, true);
                      const geojsonWithoutZ = removeZCoordinates(KMLtoGeoJSON); // Current WME Open Layers 2.13.1 geoJSON parser does not support z and or M

                      if (debug) console.timeEnd(`${scriptName}: .KMZ conversion in`);

                      // Create a layer store object for GeoJSON format
                      fileObj = new layerStoreObj(geojsonWithoutZ, color, "GEOJSON", uniqueFilename, fillOpacity, fontsize, lineopacity, linesize, linestyle, labelpos, "", "KMZ");
                    } else {
                      // Create a layer store object for KML format
                      fileObj = new layerStoreObj(content, color, "KML", uniqueFilename, fillOpacity, fontsize, lineopacity, linesize, linestyle, labelpos, "", "KMZ");
                    }

                    parseFile(fileObj);
                  });
                } catch (error) {
                  toggleParsingMessage(false);
                  handleError("KMZ read operation")(error);
                }
              })();
              break;

            case "GML":
              try {
                if (forceGeoJSON) {
                  if (debug) console.log(`${scriptName}: .GML file found, forceGeoJSON is ON.... converting to GEOJSON...`);
                  if (debug) console.time(`${scriptName}: .GML conversion in`);

                  const geoGMLer = new GeoGMLer(); // WIP, but does the basics well and more GML versions than the OpenLayers 2.13.1 or even OL 4.X parsers
                  const gmlDoc = geoGMLer.read(e.target.result);
                  const GMLtoGeoJSON = geoGMLer.toGeoJSON(gmlDoc);

                  if (debug) console.log(`${scriptName}: GML GeoJSON:`, GMLtoGeoJSON);
                  if (debug) console.timeEnd(`${scriptName}: .GML conversion in`);

                  fileObj = new layerStoreObj(GMLtoGeoJSON, color, "GEOJSON", filename, fillOpacity, fontsize, lineopacity, linesize, linestyle, labelpos, "", fileext);
                } else {
                  if (debug) console.log(`${scriptName}: .GML file found, forceGeoJSON is OFF.... passing to OpenLayers...`);
                  fileObj = new layerStoreObj(e.target.result, color, fileext, filename, fillOpacity, fontsize, lineopacity, linesize, linestyle, labelpos, "", fileext);
                }
                parseFile(fileObj);
              } catch (error) {
                toggleParsingMessage(false);
                handleError("GML conversion")(error);
              }
              break;

            case "GEOJSON":
              try {
                if (debug) console.log(`${scriptName}: .GEOJSON file found ... passing to OpenLayers...`);

                const geojsonWithoutZ = removeZCoordinates(e.target.result); // While WME uses OpenLayers 2.13.1, the GeoJSON parser fails if it encounters Z and possibly M values.

                fileObj = new layerStoreObj(geojsonWithoutZ, color, fileext, filename, fillOpacity, fontsize, lineopacity, linesize, linestyle, labelpos, "", fileext);

                parseFile(fileObj);
              } catch (error) {
                toggleParsingMessage(false);
                handleError("GEOJSON parsing")(error);
              }
              break;

            default:
              toggleParsingMessage(false);
              handleError("unsupported file type")(new Error("Unsupported file type"));
              break;
          }
        } catch (error) {
          toggleParsingMessage(false);
          handleError("file")(error);
        }
      });
    };

    if (fileext === "ZIP" || fileext === "KMZ") {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }

    function handleError(context) {
      return (error) => {
        console.error(`${scriptName}: Error parsing ${context}:`, error);
        WazeWrap.Alerts.error(scriptName, `${error}`);
      };
    }
  }

  /*************************************************************************************
   * parseFile
   *
   * Description:
   * Processes a file object containing geographic data, formats, and styles it, adding the result as a vector layer
   * to the map. The function updates the User Interface (UI) to reflect the file loading status and handles
   * labeling configurations based on attribute selection within the file's data.
   *
   * Parameters:
   * @param {Object} fileObj - An object containing data and metadata for the file to be parsed.
   *   - {string} fileObj.filename - Name of the file processed.
   *   - {string} fileObj.fileext - File extension, used to determine the appropriate parser.
   *   - {string} fileObj.fileContent - Raw content of the file.
   *   - {string} fileObj.color - Specifies the color styling for the layer.
   *   - {number} fileObj.lineopacity, fileObj.linesize, fileObj.linestyle - Line styling settings.
   *   - {number} fileObj.fillOpacity - Opacity for filled areas.
   *   - {number} fileObj.fontsize - Font size for labeling purposes.
   *   - {string} fileObj.labelpos - Anchor position for any labels.
   *
   * Behavior:
   * - Outputs debug information if debugging is activated.
   * - Establishes style configurations for the vector layer using properties defined in `fileObj`.
   * - Determines the correct parser to use based on the file's extension, setting projections appropriately.
   * - Attempts to parse the file content into geographic features, logging any errors encountered.
   * - If the file's attribute contains a previously set label attribute, it proceeds to create a styled layer with labels.
   * - For files without a pre-defined label attribute, it offers an interface for user selection from the attributes.
   * - Constructs the vector layer, styles, and integrates it onto the map, managing labels based on user input or default settings.
   * - Updates the UI list items to reflect the status and details of loading the file.
   ***************************************************************************************/
  function parseFile(fileObj) {
    if (debug) console.log(`${scriptName}: parseFile(): called with input of:`, fileObj);
    const fileext = fileObj.fileext.toUpperCase();
    const orgFileext = fileObj.orgFileext.toUpperCase();
    const fileContent = fileObj.fileContent;
    const filename = fileObj.filename;
    const parser = formats[fileext];

    // Check initialization of parser
    if (!parser) {
      console.error(`${scriptName}: No parser found for format: ${fileext}`);
      return;
    }

    // Assign internal projection
    parser.internalProjection = W.map.getProjectionObject(); // currently WME is EPSG:900913
    let foundProjection = false;

    // Convert fileContent to a string if it's an object
    let contentToTest;
    if (typeof fileContent === "object") {
      contentToTest = JSON.stringify(fileContent); // Stringify the object for searching
    } else {
      contentToTest = fileContent; // Use it directly if it's already a string
    }

    // Regex pattern to capture various projections
    const projectionPattern =
      /("EPSG:\d{1,6}"|"CRS:\d{1,6}"|CRS\d{0,6}|CRS:\s*WGS84|WGS84|\bWGS\s84\b|\bCRS\s84\b|\bNAD\s83\b|NAD83|\bNAD\s27\b|NAD27|\bETRS\s89\b|ETRS89|"EPSG::\d{1,6}"|"urn:ogc:def:crs:EPSG::\d{1,6}"|"urn:ogc:def:crs:EPSG:\d{1,6}\.\d{1,6}:\d{1,6}"|"urn:ogc:def:crs:OGC:1\.3:[^"]*")/;

    // Finds the first match in the input content. While it is possible for some geometry file types to have different projections per feature, this assumes all features have the same projection.
    const match = contentToTest.match(projectionPattern);

    if (match) {
      let projection = match[0].replace(/"/g, "");

      // Check if the match exists in the projection map
      if (projectionMap[projection]) {
        if (debug) console.log(`${scriptName}: External Projection found in file: ${projection}`);
        parser.externalProjection = projectionMap[projection]; // Set the external projection
        foundProjection = true; // Mark as found
      } else {
        const supportedProjections = "EPSG:3035|3414|4214|4258|4267|4283|4326|25832|26901->26923|27700|32601->32660|32701->32760| ";
        const message = `Found unsupported projection: ${projection}. <br>Supported projections are: <br>${supportedProjections}. <br>Cannot proceed without a supported projection.`;

        console.error(`${scriptName}: Error - ${message}`);
        WazeWrap.Alerts.error(scriptName, message);

        return; // Stop further processing
      }
    }

    // Set default external projection if no match was found at all
    if (!foundProjection) {
      const message = "No External projection found. <br>Defaulting to EPSG:4326 (WGS 84).";
      if (debug) {
        console.warn(`${scriptName}: Warning - ${message}`);
        WazeWrap.Alerts.info(scriptName, message);
      }
      parser.externalProjection = projectionMap["EPSG:4326"]; // Default to WGS 84
    }

    if (debug) console.log(`${scriptName}: External projection is: ${parser.externalProjection}`);
    if (debug) console.log(`${scriptName}: Internal projection is: ${parser.internalProjection}`);

    let features;
    try {
      features = parser.read(fileContent);

      if (features.length === 0) {
        toggleParsingMessage(false); // Turned on in addGeometryLayer()
        WazeWrap.Alerts.error(scriptName, `No features found in file ${filename}.${orgFileext}`);
        console.warn(`${scriptName}: No features found in file ${filename}.${orgFileext}.`);
        return; // stop further execution when no features are found
      }

      if (debug) console.log(`${scriptName}: Found ${features.length} features for ${filename}.${orgFileext}.`);
    } catch (error) {
      toggleParsingMessage(false); // Turned on in addGeometryLayer()
      console.error(`${scriptName}: Error parsing file content for ${filename}.${orgFileext}:`, error);
      WazeWrap.Alerts.error(scriptName, `Error parsing file content for ${filename}.${orgFileext}:\n${error}`);
      return;
    }

    toggleParsingMessage(false); // Turned on in addGeometryLayer()

    if (fileObj.labelattribute) {
      createLayerWithLabel(fileObj, features, parser.externalProjection); // Use the stored label attribute if it already exists
    } else {
      if (Array.isArray(features)) {
        if (debug) console.log(`${scriptName}: Sample features objects:`, features.slice(0, 10));

        // Await user interaction to get the label attribute when it's not already set
        presentFeaturesAttributes(features.slice(0, 50), features.length)
          .then((selectedAttribute) => {
            if (selectedAttribute) {
              fileObj.labelattribute = selectedAttribute;
              console.log(`${scriptName}: Label attribute selected: ${fileObj.labelattribute}`);
              createLayerWithLabel(fileObj, features, parser.externalProjection);
            }
          })
          .catch((cancelReason) => {
            console.warn(`${scriptName}: User cancelled attribute selection and import: ${cancelReason}`);
          });
      } else {
        // Directly create the layer with the features when it is not an array
        createLayerWithLabel(fileObj, features, parser.externalProjection);
      }
    }
  }

  /******************************************************************************************
   * createLayerWithLabel
   *
   * Description:
   * Configures and adds a new vector layer to the map, applying styling and dynamic labeling
   * based on attributes from the geographic features. This function manages the label style context,
   * constructs the layer, updates the UI with toggler controls, and stores the layer configuration
   * in IndexedDB storage to preserve its state across sessions.
   *
   * Parameters:
   * @param {Object} fileObj - Object containing metadata and styling options for the layer.
   *   - {string} fileObj.filename - The name of the file, used for layer identification.
   *   - {string} fileObj.color - The color used for styling the layer.
   *   - {number} fileObj.lineopacity - Opacity for line styling.
   *   - {number} fileObj.linesize - Width of lines in the layer.
   *   - {string} fileObj.linestyle - Dash style for lines.
   *   - {number} fileObj.fillOpacity - Opacity for filling geometries.
   *   - {number} fileObj.fontsize - Font size for labels and points.
   *   - {string} fileObj.labelattribute - Template string for labeling features; may use `${attribute}` syntax.
   *   - {string} fileObj.labelpos - Position for label text alignment.
   * @param {Array} features - Array of geographic features to be added to the layer.
   * @param {Object} externalProjection - Projection object for transforming feature coordinates as necessary.
   *
   * Behavior:
   * - Constructs a label context with functions to format and position labels based on feature attributes.
   * - Defines layer styling using attributes from `fileObj` and assigns a context for dynamic label computation.
   * - Creates a new vector layer, sets its unique ID, and assigns a z-index for rendering order.
   * - Uses `OpenLayers.StyleMap` to apply the defined style and attaches provided features to the layer.
   * - Prevents duplicate storage by checking existing layers, updating IndexedDB storage only for new layers.
   * - Registers the layer with a group toggler, providing UI controls for visibility management.
   * - Integrates the layer into the main map and manages additional elements like toggling and list updates.
   ******************************************************************************************/
  async function createLayerWithLabel(fileObj, features, externalProjection) {
    toggleLoadingMessage(true); // Show the user a loading message!

    const delayDuration = 300;
    setTimeout(async () => {
      try {
        let labelContext = {
          formatLabel: function (feature) {
            let labelTemplate = fileObj.labelattribute;

            if (!labelTemplate || labelTemplate.trim() === "") {
              return "";
            }

            // Handle new lines /n & <br>
            labelTemplate = labelTemplate.replace(/\\n/g, "\n").replace(/<br\s*\/?>/gi, "\n");

            // If the labelTemplate does not include a ${ placeholder, return it as is
            if (!labelTemplate.includes("${")) {
              return labelTemplate;
            }

            // Handle templated inputs like '${name}'
            labelTemplate = labelTemplate
              .replace(/\${(.*?)}/g, (match, attributeName) => {
                attributeName = attributeName.trim();

                if (feature.attributes.hasOwnProperty(attributeName)) {
                  let attributeValue = feature.attributes[attributeName] || "";
                  // Replace <br> with \n in the attribute value
                  attributeValue = attributeValue.replace(/<br\s*\/?>/gi, "\n");
                  return attributeValue;
                }

                return ""; // Replace with empty if attribute not found
              })
              .trim();

            return labelTemplate;
          },
        };

        const layerStyle = {
          stroke: true,
          strokeColor: fileObj.color,
          strokeOpacity: fileObj.lineopacity,
          strokeWidth: fileObj.linesize,
          strokeDashstyle: fileObj.linestyle,
          fillColor: fileObj.color,
          fillOpacity: fileObj.fillOpacity,
          pointRadius: fileObj.fontsize,
          fontColor: fileObj.color,
          fontSize: fileObj.fontsize,
          labelOutlineColor: "black",
          labelOutlineWidth: fileObj.fontsize / 4,
          labelAlign: fileObj.labelpos,
          label: "${formatLabel}",
          //pathLabel: "${formatLabel}",
          //labelSelect: false,
          //pathLabelYOffset: "${getOffset}",
          //pathLabelCurve: "${getSmooth}",
          //pathLabelReadable: "${getReadable}",
        };

        let defaultStyle = new OpenLayers.Style(layerStyle, { context: labelContext });
        let layerid = `wme_geometry_${layerindex}`;

        let WME_Geometry = new OpenLayers.Layer.Vector(`Geometry: ${fileObj.filename}`, {
          rendererOptions: { zIndexing: true },
          uniqueName: layerid,
          layerGroup: "wme_geometry",
        });

        WME_Geometry.setZIndex(-9999);
        I18n.translations[I18n.locale].layers.name[layerid] = `WME Geometries: ${fileObj.filename}`;
        WME_Geometry.styleMap = new OpenLayers.StyleMap(defaultStyle);
        WME_Geometry.addFeatures(features);

        if (debug) console.log(`${scriptName}: New OpenLayers Geometry Object:`, WME_Geometry);

        if (!groupToggler) {
          groupToggler = addGroupToggler(false, "layer-switcher-group_wme_geometries", "WME Geometries");
        }

        addToGeoList(fileObj.filename, fileObj.color, fileObj.orgFileext, fileObj.labelattribute, externalProjection);
        addLayerToggler(groupToggler, fileObj.filename, WME_Geometry);

        // Add the layer to the map before attempting storage
        W.map.addLayer(WME_Geometry);

        // Check and store layers in IndexedDB
        try {
          await storeLayer(fileObj);
        } catch (error) {
          console.error(`${scriptName}: Failed to store data in IndexedDB:`, error);
          WazeWrap.Alerts.error("Storage Error", "Failed to store data. Ensure IndexedDB is not full and try again. Layer will not be saved.");
        }

        if (debug) console.log(`${scriptName}: New Layer ${fileObj.filename} Added`);
      } finally {
        toggleLoadingMessage(false); // Turn off the loading message!
      }
    }, delayDuration);
  }

  /**
   * storeLayer
   *
   * Asynchronously stores a given file object in an IndexedDB object store named "layers".
   * If the file object is not already stored (determined by its filename), it will compress the object,
   * calculate its size in kilobits and megabits, and then store it.
   *
   * @param {Object} fileObj - The file object to be stored, which must include a 'filename' property.
   *
   * The function operates as follows:
   * 1. Checks whether the file identified by 'filename' already exists in the database.
   * 2. If the file does not exist:
   *    a. Compresses the entire file object using LZString compression.
   *    b. Calculates the size of the compressed data in bits, kilobits, and megabits.
   *    c. Stores the compressed data with its filename in IndexedDB.
   *    d. Logs a message to the console with the size details.
   * 3. If the file already exists, skips the storage process and logs a message.
   *
   * @returns {Promise} - Resolves when the file is successfully stored or skipped if it exists.
   *                      Rejects with an error if an operation fails.
   */
  async function storeLayer(fileObj) {
    const transaction = db.transaction(["layers"], "readwrite");
    const store = transaction.objectStore("layers");

    return new Promise((resolve, reject) => {
      const request = store.get(fileObj.filename);

      request.onsuccess = function () {
        const existingLayer = request.result;

        if (!existingLayer) {
          // Compress the entire fileObj
          const compressedData = LZString.compress(JSON.stringify(fileObj));

          // Calculate size of compressed data
          const byteSize = compressedData.length * 2; // Assuming 2 bytes per character
          const bitSize = byteSize * 8;
          const sizeInKilobits = bitSize / 1024;
          const sizeInMegabits = bitSize / 1048576;

          const compressedFileObj = {
            filename: fileObj.filename, // Keep the filename uncompressed
            compressedData,
          };

          const addRequest = store.add(compressedFileObj);

          addRequest.onsuccess = function () {
            console.log(`${scriptName}: Stored Compressed Data file - ${fileObj.filename}. Size: ${sizeInKilobits.toFixed(2)} Kb, ${sizeInMegabits.toFixed(3)} Mb`);
            resolve();
          };

          addRequest.onerror = function (event) {
            console.error(`${scriptName}: Failed to store data in IndexedDB`, event.target.error);
            reject(new Error("Failed to store data"));
          };
        } else {
          console.log(`${scriptName}: Skipping duplicate storage for file: ${fileObj.filename}`);
          resolve();
        }
      };

      request.onerror = function (event) {
        console.error(`${scriptName}: Failed to retrieve data from IndexedDB`, event.target.error);
        reject(new Error("Failed to retrieve data"));
      };
    });
  }

  function toggleLoadingMessage(show) {
    const existingMessage = document.getElementById("WMEGeoLoadingMessage");

    if (show) {
      if (!existingMessage) {
        const loadingMessage = document.createElement("div");
        loadingMessage.id = "WMEGeoLoadingMessage";
        loadingMessage.style = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          padding: 16px 32px;
          background: rgba(0, 0, 0, 0.7);
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
          font-family: 'Arial', sans-serif;
          font-size: 1.1rem;
          text-align: center;
          z-index: 2000;
          color: #ffffff;
          border: 2px solid #ff5733;
        `;
        loadingMessage.textContent = "WME Geometries: New Geometries Loading, please wait...";
        document.body.appendChild(loadingMessage);
      }
    } else {
      if (existingMessage) {
        existingMessage.remove();
      }
    }
  }

  function toggleParsingMessage(show) {
    const existingMessage = document.getElementById("WMEGeoParsingMessage");

    if (show) {
      if (!existingMessage) {
        const parsingMessage = document.createElement("div");
        parsingMessage.id = "WMEGeoParsingMessage";
        parsingMessage.style = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          padding: 16px 32px;
          background: rgba(0, 0, 0, 0.7);
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
          font-family: 'Arial', sans-serif;
          font-size: 1.1rem;
          text-align: center;
          z-index: 2000;
          color: #ffffff;
          border: 2px solid #33ff57;
        `;
        parsingMessage.textContent = "WME Geometries: Parsing and converting input files, please wait...";
        document.body.appendChild(parsingMessage);
      }
    } else {
      if (existingMessage) {
        existingMessage.remove();
      }
    }
  }

  /**********************************************************************************************************
   * presentFeaturesAttributes
   *
   * Description:
   * Displays a user interface to facilitate the selection of an attribute from a set of geographic features.
   * If there is only one attribute, it automatically resolves with that attribute. Otherwise, it presents a modal
   * dialog with a dropdown list for the user to select the label attribute.
   *
   * Parameters:
   * @param {Array} features - An array of feature objects, each containing a set of attributes to choose from.
   *
   * Returns:
   * @returns {Promise} - A promise that resolves with the chosen attribute or rejects if the user cancels.
   *
   * Behavior:
   * - Immediately resolves if there is only one attribute across all features.
   * - Constructs a modal dialog centrally positioned on the screen to display feature properties.
   * - Iterates over the provided features, listing the attributes for each feature in a scrollable container.
   * - Utilizes a dropdown (`select` element) populated with the attributes for user selection.
   * - Includes "Import" and "Cancel" buttons to either resolve the promise with the selected attribute
   *   or reject the promise, respectively.
   * - Ensures modal visibility with a semi-transparent overlay backdrop.
   *****************************************************************************************************/
  function presentFeaturesAttributes(features, nbFeatures) {
    return new Promise((resolve, reject) => {
      const allAttributes = features.map((feature) => Object.keys(feature.attributes));
      const attributes = Array.from(new Set(allAttributes.flat()));

      let attributeInput = document.createElement("div");
      attributeInput.style.cssText = "position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 1001; width: 80%; max-width: 600px; padding: 10px; background: #fff; border: 3px solid #ccc; border-radius: 5%; display: flex; flex-direction: column;";

      let title = document.createElement("label");
      title.style.cssText = "margin-bottom: 5px; color: #333; align-self: center; font-size: 1.2em;";
      title.innerHTML = `Feature Attributes<br>Total Features: ${nbFeatures}`;
      attributeInput.appendChild(title);

      let message = document.createElement("p");
      message.style.cssText = "margin-top: 10px; color: #777; text-align: center;";

      let propsContainer = document.createElement("div");
      propsContainer.style.cssText = "overflow-y: auto; max-height: 300px; padding: 5px; background-color: #f0f0f0; border: 1px solid black; border-radius: 10px;";
      attributeInput.appendChild(propsContainer);

      features.forEach((feature, index) => {
        let featureHeader = document.createElement("label");
        featureHeader.style.cssText = "color: #333; font-size: 1.1em;";
        featureHeader.textContent = `Feature ${index + 1}`;
        propsContainer.appendChild(featureHeader);

        let propsList = document.createElement("ul");
        Object.keys(feature.attributes).forEach((key) => {
          let propItem = document.createElement("li");
          propItem.style.cssText = "list-style-type: none; padding: 2px; font-size: 0.9em;";
          propItem.innerHTML = `<span style="color: blue;">${key}</span>: ${feature.attributes[key]}`;
          propsList.appendChild(propItem);
        });
        propsContainer.appendChild(propsList);
      });

      let inputLabel = document.createElement("label");
      inputLabel.style.cssText = "display: block; margin-top: 15px;";
      inputLabel.textContent = "Select Attribute to use for Label:";
      attributeInput.appendChild(inputLabel);

      let selectBox = document.createElement("select");
      selectBox.style.cssText = "width: 90%; padding: 8px; margin-top: 5px; margin-left: 5%; margin-right: 5%; border-radius: 5px;";
      attributes.forEach((attribute) => {
        let option = document.createElement("option");
        option.value = attribute;
        option.textContent = attribute;
        selectBox.appendChild(option);
      });

      // Add "No Labels" and "Custom Label" options
      let noLabelsOption = document.createElement("option");
      noLabelsOption.value = "";
      noLabelsOption.textContent = "- No Labels -";
      selectBox.appendChild(noLabelsOption);

      let customLabelOption = document.createElement("option");
      customLabelOption.value = "custom";
      customLabelOption.textContent = "Custom Label";
      selectBox.appendChild(customLabelOption);

      attributeInput.appendChild(selectBox);

      let customLabelInput = document.createElement("textarea");
      customLabelInput.placeholder = `Enter your custom label using \${attributeName} for dynamic values.
        Feature 1
          BridgeNumber: 01995
          FacilityCarried: U.S. ROUTE 6
          FeatureCrossed: BIG RIVER
        
        Example: (explicit new lines formatting)
        #:\${BridgeNumber}\\n\${FacilityCarried} over\\n\${FeatureCrossed}
        
        Example: (multi-line formatting)
        #:\${BridgeNumber}
        \${FacilityCarried} over
        \${FeatureCrossed}

        Expected Output: 
          #:01995
          U.S. ROUTE 6 over
          BIG RIVER`;
      customLabelInput.style.cssText = "width: 90%; height: 300px; max-height: 300px; padding: 8px; font-size: 1rem; border: 2px solid #ddd; border-radius: 5px; box-sizing: border-box; resize: vertical; display: none; margin-top: 5px; margin-left: 5%; margin-right: 5%;";
      attributeInput.appendChild(customLabelInput);

      selectBox.addEventListener("change", () => {
        customLabelInput.style.display = selectBox.value === "custom" ? "block" : "none";
      });

      let buttonsContainer = document.createElement("div");
      buttonsContainer.style.cssText = "margin-top: 10px; display: flex; justify-content: flex-end; width: 90%; margin-left: 5%; margin-right: 5%;";

      let importButton = createButton("Import", "#8BC34A", "#689F38", "#FFFFFF", "button");
      importButton.onclick = () => {
        if (selectBox.value === "custom" && customLabelInput.value.trim() === "") {
          WazeWrap.Alerts.error(scriptName, "Please enter a custom label expression when selecting 'Custom Label'.");
          return;
        }

        document.body.removeChild(overlay);

        let resolvedValue;
        if (selectBox.value === "custom" && customLabelInput.value.trim() !== "") {
          resolvedValue = customLabelInput.value.trim();
        } else if (selectBox.value !== "- No Labels -") {
          resolvedValue = `\${${selectBox.value}}`;
        } else {
          resolvedValue = "";
        }
        resolve(resolvedValue);
      };

      let cancelButton = createButton("Cancel", "#E57373", "#D32F2F", "#FFFFFF", "button");
      cancelButton.onclick = () => {
        document.body.removeChild(overlay);
        reject("Operation cancelled by the user");
      };

      buttonsContainer.appendChild(importButton);
      buttonsContainer.appendChild(cancelButton);
      attributeInput.appendChild(buttonsContainer);

      let overlay = document.createElement("div");
      overlay.id = "presentFeaturesAttributesOverlay";
      overlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000;";
      overlay.appendChild(attributeInput);

      document.body.appendChild(overlay);
    });
  }

  /*************************************************************************************
   * addToGeoList
   *
   * Description:
   * Adds a new list item (representing a geographic file) to the UI's geographic file list. Each item displays the filename
   * and includes a tooltip with additional file information, like file type, label attribute, and projection details.
   * A remove button is also provided to delete the layer from the list and handle associated cleanup.
   *
   * Parameters:
   * @param {string} filename - The name of the file, used as the display text and ID.
   * @param {string} color - The color used to style the filename text.
   * @param {string} fileext - The extension/type of the file; included in the tooltip.
   * @param {string} labelattribute - The label attribute used; included in the tooltip.
   * @param {Object} externalProjection - The projection details; included in the tooltip.
   *
   * Behavior:
   * - Creates a list item styled with CSS properties for layout and hover effects.
   * - Displays the filename in the specified color, with text overflow handling.
   * - Provides additional file details in a tooltip triggered on hover.
   * - Adds a remove button to each list item, invoking the `removeGeometryLayer` function when clicked.
   * - Appends each configured list item to the global `geolist` element for UI rendering.
   ****************************************************************************************/
  function addToGeoList(filename, color, fileext, labelattribute, externalProjection) {
    let liObj = document.createElement("li");
    liObj.id = filename.replace(/[^a-z0-9_-]/gi, "_");
    liObj.style.cssText = "position: relative; padding: 2px 2px; margin: 2px 0; background: transparent; border-radius: 3px; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s; font-size: 0.95em;";

    liObj.addEventListener("mouseover", function () {
      liObj.style.background = "#eaeaea";
    });

    liObj.addEventListener("mouseout", function () {
      liObj.style.background = "transparent";
    });

    let fileText = document.createElement("span");
    fileText.style.cssText = `color: ${color}; flex-grow: 1; flex-shrink: 1; flex-basis: auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 5px;`;
    fileText.innerHTML = filename;

    const tooltipContent = `File Type: ${fileext}\nLabel: ${labelattribute}\nProjection: ${externalProjection}`;
    fileText.title = tooltipContent;

    liObj.appendChild(fileText);

    let removeButton = document.createElement("button");
    removeButton.innerHTML = "X";
    removeButton.style.cssText = "flex: none; background-color: #E57373; color: white; border: none; padding: 0; width: 16px; height: 16px; cursor: pointer; margin-left: 3px;";
    removeButton.addEventListener("click", () => removeGeometryLayer(filename));
    liObj.appendChild(removeButton);

    geolist.appendChild(liObj);
  }

  function createButton(text, bgColor, mouseoverColor, textColor, type = "button", labelFor = "") {
    let element;

    if (type === "label") {
      element = document.createElement("label");
      element.textContent = text;

      if (labelFor) {
        element.htmlFor = labelFor;
      }
    } else if (type === "input") {
      element = document.createElement("input");
      element.type = "button";
      element.value = text;
    } else {
      element = document.createElement("button");
      element.textContent = text;
    }

    element.style.cssText = `padding: 8px 0; font-size: 1rem; border: 2px solid ${bgColor}; border-radius: 20px; cursor: pointer; background-color: ${bgColor}; color: ${textColor}; 
    box-sizing: border-box; transition: background-color 0.3s, border-color 0.3s; font-weight: bold; text-align: center; display: flex; justify-content: center; align-items: center; 
    width: 95%; margin-top: 3px; margin-left: 5px; margin-right: 5px;`;

    element.addEventListener("mouseover", function () {
      element.style.backgroundColor = mouseoverColor;
      element.style.borderColor = mouseoverColor;
    });

    element.addEventListener("mouseout", function () {
      element.style.backgroundColor = bgColor;
      element.style.borderColor = bgColor;
    });

    return element; // Assuming you need to return the created element
  }

  function createButtonWithInfo(text, bgColor, mouseoverColor, textColor, type, infoHtml) {
    let buttonContainer = document.createElement("div");
    buttonContainer.style.cssText = "position: relative; display: inline-block; margin: 5px;";

    let button = createButton(text, bgColor, mouseoverColor, textColor, type);
    //button.style.color = textColor;
    buttonContainer.appendChild(button);

    let tooltip = document.createElement("div");
    tooltip.innerHTML = infoHtml;
    tooltip.style.cssText = `
    display: none;
    position: absolute;
    background-color: #f9f9f9;
    border: 1px solid #ccc;
    padding: 10px;
    border-radius: 5px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    top: 100%; /* Below the button */
    left: 0%; /* Center horizontally */
    transform: translateX(-0%); /* Center the tooltip */
    white-space: normal;
    z-index: 1;
    `;
    buttonContainer.appendChild(tooltip);

    // Show tooltip on hover
    buttonContainer.addEventListener("mouseenter", () => {
      tooltip.style.display = "block";
    });
    buttonContainer.addEventListener("mouseleave", () => {
      tooltip.style.display = "none";
    });

    return buttonContainer;
  }

  /***************************************************************************
   * removeGeometryLayer
   *
   * Description:
   * This function removes a specified geometry layer from the map, updates the stored layers,
   * and manages corresponding UI elements and local storage entries.
   *
   * Parameters:
   * @param {string} filename - The name of the file associated with the geometry layer to be removed.
   *
   * Behavior:
   * - Identifies and destroys the specified geometry layer from the map.
   * - Updates the `storedLayers` array by removing the layer corresponding to the filename.
   * - Identifies and removes UI elements associated with the layer:
   *   - The toggler item identified by the prefixed ID "t_[sanitizedFilename]".
   *   - The list item identified by the filename.
   * - Updates local storage:
   *   - Removes the entire storage entry if no layers remain.
   *   - Compresses and updates the storage entry with remaining layers if any exist.
   * - Logs the changes in local storage size.
   ****************************************************************************/
  async function removeGeometryLayer(filename) {
    const layerName = `Geometry: ${filename}`;
    const layers = W.map.getLayersBy("layerGroup", "wme_geometry");
    const layerToDestroy = layers.find((layer) => layer.name === layerName);

    if (!layerToDestroy) {
      console.log(`${scriptName}: No layer found for (${filename})`);
      return;
    }

    // Destroy the layer
    layerToDestroy.destroy();

    // Asynchronously remove the layer from IndexedDB
    try {
      await removeLayerFromIndexedDB(filename);
      console.log(`${scriptName}: Removed file - ${filename} from IndexedDB.`);
    } catch (error) {
      console.error(`${scriptName}: Failed to remove layer ${filename} from IndexedDB:`, error);
    }

    // Sanitize filename and define IDs
    const listItemId = filename.replace(/[^a-z0-9_-]/gi, "_");
    const layerTogglerId = `t_${listItemId}`;

    // Remove the toggler item if it exists
    const togglerItem = document.getElementById(layerTogglerId);
    if (togglerItem?.parentElement) {
      togglerItem.parentElement.removeChild(togglerItem);
    }

    // Remove any list item using the listItemId
    const listItem = document.getElementById(listItemId);
    if (listItem) {
      listItem.remove();
    }
  }

  // Function to remove a layer from IndexedDB
  async function removeLayerFromIndexedDB(filename) {
    if (!db) {
      // Check if the database is initialized
      console.error("Database not initialized");
      return Promise.reject(new Error("Database not initialized"));
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["layers"], "readwrite");
      const store = transaction.objectStore("layers");
      const request = store.delete(filename);

      // Transaction-level error handling
      transaction.onerror = function (event) {
        console.error("Transaction error:", event.target.error);
        reject(new Error("Transaction failed during deletion"));
      };

      // Request-specific success and error handling
      request.onsuccess = function () {
        console.log(`Layer with filename ${filename} successfully deleted`);
        resolve();
      };

      request.onerror = function (event) {
        console.error("Error deleting layer:", event.target.error);
        reject(new Error("Failed to delete layer from database"));
      };
    });
  }

  /********************************************************************
   * createLayersFormats
   *
   * Description:
   * Initializes and returns an object of supported geometric data formats for use in parsing and rendering map data.
   * This function checks for the availability of various format parsers and creates instance objects for each, capturing
   * any parsing capabilities with error handling.
   *
   * Process:
   * - Verifies the availability of the `Wkt` library, logging an error if it is not loaded.
   * - Defines a helper function `tryCreateFormat` to instantiate format objects and log successes or errors.
   * - Attempts to create format instances for GEOJSON, WKT, KML, GPX, GML, OSM, and ZIP files of (SHP,SHX,DBF) using corresponding constructors.
   * - Continually builds a `formathelp` string that lists all formats successfully instantiated.
   * - Returns an object containing both the instantiated formats and the help string.
   *
   * Notes:
   * - Ensures debug logs are provided for tracing function execution when `debug` mode is active.
   **************************************************************/
  function createLayersFormats() {
    let formats = {};
    let formathelp = "";

    function tryCreateFormat(formatName, formatUtility) {
      try {
        if (typeof formatUtility === "function") {
          // Test if it should be used as a constructor
          try {
            const formatInstance = new formatUtility();
            formats[formatName] = formatInstance;
          } catch (constructorError) {
            // If it throws, it's not meant to be used as a constructor
            formats[formatName] = formatUtility;
          }
          formathelp += `${formatName} | `;
          console.log(`${scriptName}: Successfully added format: ${formatName}`);
        } else {
          console.warn(`${scriptName}: ${formatName} is not a valid function or constructor.`);
        }
      } catch (error) {
        console.error(`${scriptName}: Error creating format ${formatName}:`, error);
      }
    }

    if (typeof OpenLayers !== "undefined" && typeof OpenLayers.Format !== "undefined") {
      tryCreateFormat("GEOJSON", OpenLayers.Format.GeoJSON);
      tryCreateFormat("KML", OpenLayers.Format.KML);
      tryCreateFormat("KMZ", GeoKMZer);
      tryCreateFormat("GML", OpenLayers.Format.GML);
      tryCreateFormat("GPX", OpenLayers.Format.GPX);
      tryCreateFormat("WKT", OpenLayers.Format.WKT);
    } else {
      console.error(`${scriptName}: OpenLayers or OpenLayers.Format for GEOJSON, KML, GML, GPX or WKT is not available.`);
    }

    if (typeof GeoSHPer !== "undefined") {
      formats["ZIP"] = "GeoSHPer"; // Denoting the use of the the GeoSHPer library
      console.log(`${scriptName}: Successfully added format: ZIP (shapefile)`);
      formathelp += "ZIP(SHP,DBF,PRJ,CPG) | ";
    } else {
      console.error(`${scriptName}: Shapefile support (GeoSHPer) is not available.`);
    }

    console.log(`${scriptName}: Finished loading document format parsers.`);
    return { formats, formathelp };
  }

  /***********************************************************************************
   * addGroupToggler
   *
   * Description:
   * This function creates and adds a group toggler to a layer switcher UI component. It manages the visibility and interaction
   * of different layer groups within a map or similar UI, providing a toggling mechanism for user interface groups.
   *
   * Parameters:
   * @param {boolean} isDefault - A flag indicating whether the group is a default group.
   * @param {string} layerSwitcherGroupItemName - The unique name used as an identifier for the layer switcher group element.
   * @param {string} layerGroupVisibleName - The human-readable name for the layer group, shown in the UI.
   *
   * Returns:
   * @returns {HTMLElement} - The group element that has been created or modified.
   *
   * Behavior:
   * - If `isDefault` is true, it retrieves and operates on the existing group element related to the provided name.
   * - Otherwise, it dynamically creates a new group list item.
   * - Builds a toggler that includes a caret icon, a toggle switch, and a label displaying the group's visible name.
   * - Attaches event handlers to manage collapsible behavior of the group toggler and switches.
   * - Appends the configured group to the main UI component, either as an existing group or newly created one.
   * - Logs the creation of the group toggler to the console for debugging purposes.
   *****************************************************************************************/
  function addGroupToggler(isDefault, layerSwitcherGroupItemName, layerGroupVisibleName) {
    var group;
    if (isDefault === true) {
      group = document.getElementById(layerSwitcherGroupItemName).parentElement.parentElement;
    } else {
      var layerGroupsList = document.getElementsByClassName("list-unstyled togglers")[0];
      group = document.createElement("li");
      group.className = "group";

      var togglerContainer = document.createElement("div");
      togglerContainer.className = "layer-switcher-toggler-tree-category";

      var groupButton = document.createElement("wz-button");
      groupButton.color = "clear-icon";
      groupButton.size = "xs";

      var iCaretDown = document.createElement("i");
      iCaretDown.className = "toggle-category w-icon w-icon-caret-down";
      iCaretDown.dataset.groupId = layerSwitcherGroupItemName.replace("layer-switcher-", "").toUpperCase();

      var togglerSwitch = document.createElement("wz-toggle-switch");
      togglerSwitch.className = layerSwitcherGroupItemName + " hydrated";
      togglerSwitch.id = layerSwitcherGroupItemName;
      togglerSwitch.checked = true;

      var label = document.createElement("label");
      label.className = "label-text";
      label.htmlFor = togglerSwitch.id;

      var togglerChildrenList = document.createElement("ul");
      togglerChildrenList.className = "collapsible-" + layerSwitcherGroupItemName.replace("layer-switcher-", "").toUpperCase();
      label.appendChild(document.createTextNode(layerGroupVisibleName));
      groupButton.addEventListener("click", layerTogglerGroupMinimizerEventHandler(iCaretDown));
      togglerSwitch.addEventListener("click", layerTogglerGroupMinimizerEventHandler(iCaretDown));
      groupButton.appendChild(iCaretDown);
      togglerContainer.appendChild(groupButton);
      togglerContainer.appendChild(togglerSwitch);
      togglerContainer.appendChild(label);
      group.appendChild(togglerContainer);
      group.appendChild(togglerChildrenList);
      layerGroupsList.appendChild(group);
    }

    if (debug) console.log(`${scriptName}: Group Toggler created for ${layerGroupVisibleName}`);
    return group;
  }

  /******************************************************************************
   * addLayerToggler
   *
   * Description:
   * This function adds a toggler for individual layers within a group in a layer switcher UI component. It manages the visibility
   * and interaction for specific map layers, allowing users to toggle them on and off within a UI group.
   *
   * Parameters:
   * @param {HTMLElement} groupToggler - The parent group toggler element under which the layer toggler is added.
   * @param {string} layerName - The name of the layer, used for display and creating unique identifiers.
   * @param {Object} layerObj - The layer object that is being toggled, typically representing a map or UI layer.
   *
   * Behavior:
   * - Locates the container (UL) within the group toggler where new layer togglers are to be appended.
   * - Creates a checkbox element for the layer, setting it to checked by default for visibility.
   * - Attaches events to both the individual layer checkbox and the group checkbox for toggling functionality.
   * - Appends the fully configured toggler to the UI.
   * - Logs the creation of the layer toggler for debugging purposes.
   *******************************************************************************************/
  function addLayerToggler(groupToggler, layerName, layerObj) {
    var layer_container = groupToggler.getElementsByTagName("UL")[0];
    var layerGroupCheckbox = groupToggler.getElementsByClassName("layer-switcher-toggler-tree-category")[0].getElementsByTagName("wz-toggle-switch")[0];
    var toggler = document.createElement("li");
    var togglerCheckbox = document.createElement("wz-checkbox");
    togglerCheckbox.setAttribute("checked", "true");

    // Generate ID for togglerCheckbox using layerName
    var togglerId = layerName.replace(/[^a-z0-9_-]/gi, "_");
    togglerCheckbox.id = "t_" + togglerId;

    togglerCheckbox.className = "hydrated";
    togglerCheckbox.appendChild(document.createTextNode(layerName));
    toggler.appendChild(togglerCheckbox);
    layer_container.appendChild(toggler);
    togglerCheckbox.addEventListener("change", layerTogglerEventHandler(layerObj));
    layerGroupCheckbox.addEventListener("change", layerTogglerGroupEventHandler(togglerCheckbox, layerObj));
    layerTogglerEventHandler(layerObj);
    layerTogglerGroupEventHandler(togglerCheckbox, layerObj);

    if (debug) console.log(`${scriptName}: Layer Toggler created for ${layerName}`);
  }

  function layerTogglerEventHandler(layerObj) {
    return function () {
      const isVisible = this.checked;
      // Toggle the visibility of the layer
      layerObj.setVisibility(isVisible);
    };
  }

  function layerTogglerGroupEventHandler(groupCheckbox, layerObj) {
    return function () {
      // Determine if the layer should be visible based on the checkboxes
      const shouldBeVisible = this.checked && groupCheckbox.checked;

      // Set the layer's visibility directly
      layerObj.setVisibility(shouldBeVisible);

      // Optionally adjust checkbox behavior, depending on what you want
      groupCheckbox.disabled = !this.checked;
      if (!groupCheckbox.checked) {
        groupCheckbox.disabled = false;
      }
    };
  }

  function layerTogglerGroupMinimizerEventHandler(iCaretDown) {
    return function () {
      const ulCollapsible = iCaretDown.closest("li").querySelector("ul");
      iCaretDown.classList.toggle("upside-down");
      ulCollapsible.classList.toggle("collapse-layer-switcher-group");
    };
  }

  /******************************************************************************
   * removeZCoordinates
   *
   * Description:
   * This function processes GeoJSON data to remove Z and M coordinates, ensuring that all geometries contain only 2D coordinates (X, Y).
   * This is particularly useful when integrating with libraries, such as OpenLayers, that may not support Z or M dimensions.
   *
   * Parameters:
   * @param {Object} geojson - The GeoJSON object that contains features with geometry data that may include Z or M values.
   *
   * Behavior:
   * - Defines a helper function, `stripZ`, to recursively remove additional dimensions from coordinates.
   * - Iterates over each feature in the GeoJSON data, applying the `stripZ` function to all geometry coordinate arrays.
   * - Constructs and returns a new GeoJSON object with updated geometries that only include 2D coordinates.
   * - Ensures compatibility with tools that require strictly 2D geometries by removing unnecessary dimensions.
   *******************************************************************************************/
  function removeZCoordinates(geojson) {
    // Check if the input is a string and parse it
    if (typeof geojson === "string") {
      try {
        geojson = JSON.parse(geojson);
      } catch (error) {
        throw new Error("Invalid JSON string provided.");
      }
    }

    // Ensure it is an object and has features property
    if (typeof geojson !== "object" || !geojson.features || !Array.isArray(geojson.features)) {
      throw new Error("Input is not a valid GeoJSON object.");
    }

    function stripZ(coords) {
      // For multi-dimensional arrays
      if (Array.isArray(coords[0])) {
        return coords.map(stripZ);
      } else {
        // Return only the first two coordinates
        return coords.slice(0, 2);
      }
    }

    return {
      ...geojson,
      features: geojson.features.map((feature) => ({
        ...feature,
        geometry: {
          ...feature.geometry,
          coordinates: stripZ(feature.geometry.coordinates),
        },
      })),
    };
  }

  function getArcGISdata(dataType = "state") {
    // Define URLs and field names for each data type
    const CONFIG = {
      state: {
        url: "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/0",
        outFields: "BASENAME,NAME,STATE",
      },
      county: {
        url: "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1",
        outFields: "BASENAME,NAME,STATE",
      },
      countysub: {
        url: "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer/1",
        outFields: "BASENAME,NAME,STATE,COUNTY", // Example fields for County Subdivisions
      },
      // Add more configurations as needed
    };

    // Check if the dataType is valid
    const config = CONFIG[dataType.toLowerCase()];
    if (!config) {
      throw new Error(`Invalid data type: ${dataType}`);
    }

    // Obtain the center of the map in WGS84 format.
    const wgs84Center = wmeSDK.Map.getMapCenter(); // Get the current center coordinates of the WME map

    // Create a geometry object from the map center.
    const geometry = {
      x: wgs84Center.lon,
      y: wgs84Center.lat,
      spatialReference: { wkid: 4326 },
    };

    const url = `${config.url}/query?geometry=${encodeURIComponent(JSON.stringify(geometry))}`;
    const queryString = `${url}&outFields=${encodeURIComponent(config.outFields)}&returnGeometry=true&spatialRel=esriSpatialRelIntersects` + `&geometryType=esriGeometryPoint&inSR=${geometry.spatialReference.wkid}&outSR=3857&f=GeoJSON`;

    if (debug) console.log(`${scriptName}: getGeoDataUrl(${dataType})`, queryString);

    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        url: queryString,
        method: "GET",
        onload: function (response) {
          try {
            const jsonResponse = JSON.parse(response.responseText);
            resolve(jsonResponse); // Resolve the promise with the JSON response
          } catch (error) {
            reject(new Error("Failed to parse JSON response: " + error.message));
          }
        },
        onerror: function (error) {
          reject(new Error("Request failed: " + error.statusText));
        },
      });
    });
  }

  function testTransformations() {
    const testCases = [
      {
        inputCRS: "EPSG:4269", // NAD83
        //yx: false;
        units: "degrees",
        points: [
          { coordinates: [-74.044541, 40.689248], expected: [-8242600.58172, 4966613.255611] },
          { coordinates: [-122.349302, 47.620507], expected: [-13619862.010171, 6043951.303808] },
          { coordinates: [-0.08767, 51.508046], expected: [-9759.357694, 6711658.070912] },
          { coordinates: [151.2153, -33.8568], expected: [16833210.196152, -4009589.934223] },
        ],
      },
      {
        inputCRS: "EPSG:3035", // ETRS89 / LAEA
        //yx: false;
        units: "m",
        points: [
          { coordinates: [3756580.72351047, 2890108.68078267], expected: [255421.197404, 6250844.20951241] },
          { coordinates: [3623203.28874355, 3203589.85042861], expected: [-9759.357694, 6711658.070912] },
        ],
      },
      {
        inputCRS: "EPSG:4267", // NAD27
        //yx: true;
        units: "degrees",
        points: [
          { coordinates: [-74.0449283, 40.689221], expected: [-8242600.58172, 4966613.255611] },
          { coordinates: [-122.3480695, 47.6206895], expected: [-13619862.010171, 6043951.303808] },
          { coordinates: [-87.6188847, 41.8757213], expected: [-9753699.24207752, 5142393.18430405] },
        ],
      },
    ];

    const targetCRS = "EPSG:900913"; // Internal projection
    const tolerance = 0.00001; // Tolerance level
    const tolerancePercentage = tolerance * 100; // Convert to percentage for comparison

    testCases.forEach((testCase, index) => {
      testCase.points.forEach((point, pointIndex) => {
        const [inputX, inputY] = point.coordinates;
        const expected = point.expected;

        try {
          // Log input points
          console.log(`Test Case ${index + 1}.${pointIndex + 1} Input Point: [${inputX.toFixed(8)}, ${inputY.toFixed(8)}]`);

          // Create a point ensuring it's treated as geographic
          const pointOL = new OpenLayers.Geometry.Point(inputX, inputY); // (Lon, Lat)

          // Set up projections
          const projIn = new OpenLayers.Projection(testCase.inputCRS); // Input projection
          const projOut = new OpenLayers.Projection(targetCRS); // Target projection

          // Log the projections being used
          console.log(`Transforming from ${testCase.inputCRS} to ${targetCRS}`);

          // Transform the point correctly
          pointOL.transform(projIn, projOut);

          // Log the expected and actual output
          console.log(`Expected: [${expected[0].toFixed(8)}, ${expected[1].toFixed(8)}]`);
          console.log(`Got: [${pointOL.x.toFixed(8)}, ${pointOL.y.toFixed(8)}]`);

          // Calculate differences
          const olXDiff = Math.abs(expected[0] - pointOL.x);
          const olYDiff = Math.abs(expected[1] - pointOL.y);

          // Calculate percentage differences
          const olXPercentageDiff = (olXDiff / Math.abs(expected[0] || 1)) * 100; // Avoid division by zero
          const olYPercentageDiff = (olYDiff / Math.abs(expected[1] || 1)) * 100; // Avoid division by zero

          // Log the percentage differences
          console.log(`X Percentage Difference: ${olXPercentageDiff.toFixed(6)}%`);
          console.log(`Y Percentage Difference: ${olYPercentageDiff.toFixed(6)}%`);

          // Check if the percentage differences are within the defined tolerance
          const olXWithinTolerance = olXPercentageDiff < tolerancePercentage;
          const olYWithinTolerance = olYPercentageDiff < tolerancePercentage;

          if (!olXWithinTolerance) {
            console.warn(`OpenLayers X coordinate percentage difference exceeds tolerance of ${tolerancePercentage.toFixed(6)}%`);
          } else {
            console.log(`OpenLayers X coordinate is within percentage tolerance.`);
          }

          if (!olYWithinTolerance) {
            console.warn(`OpenLayers Y coordinate percentage difference exceeds tolerance of ${tolerancePercentage.toFixed(6)}%`);
          } else {
            console.log(`OpenLayers Y coordinate is within percentage tolerance.`);
          }
        } catch (error) {
          console.error(`Error processing coordinates at Test Case ${index + 1}.${pointIndex + 1}: ${error.message}`);
        }
      });
    });
  }
};
geometries();
