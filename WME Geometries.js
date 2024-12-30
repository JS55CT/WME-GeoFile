// ==UserScript==
// @name                WME Geometries (JS55CT Fork)
// @namespace           https://github.com/JS55CT
// @description         Import geometry files into Waze Map Editor. Supports GeoJSON, GML, WKT, KML, and GPX (Modified from original).
// @version             2024.12.29.01
// @downloadURL         https://raw.githubusercontent.com/JS55CT/WME-Geometries-JS55CT-Fork/main/WME%20Geometries.js
// @updateURL           https://raw.githubusercontent.com/JS55CT/WME-Geometries-JS55CT-Fork/main/WME%20Geometries.js
// @author              JS55CT
// @match               https://www.waze.com/*/editor*
// @match               https://www.waze.com/editor*
// @match               https://beta.waze.com/*
// @exclude             https://www.waze.com/*user/*editor/*
// @require             https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.4.4/lz-string.min.js
// @require             https://greasyfork.org/scripts/24851-wazewrap/code/WazeWrap.js
// @require             https://openlayers.org/api/OpenLayers.js
// @require             https://cdnjs.cloudflare.com/ajax/libs/wicket/1.3.8/wicket.js
// @grant               none
// @license             MIT
// @original-author     Timbones
// @original-contributors wlodek76, Twister-UK
// @original-source     https://greasyfork.org/en/scripts/8129-wme-geometries
// ==/UserScript==

/********
 * TO DO LIST:
 *  1. Update Labels for line feachers for pathLabel? and pathLabelCurve?
 *  2. When adding via a geojson, KML file see if we can parse the oject atrabutes, and provide a user input to select the field to use for the labels. 
 *********/

var geometries = function () {
  "use strict";
  const scriptMetadata = GM_info.script;
  const scriptName = scriptMetadata.name;
  let maxlabels = 100000; // maximum number of features that will be shown with labels
  let labelname = /^name|name$|^label|label$/;

  let geolist;
  let debug = false;

  let { formats, formathelp } = createLayersFormats();
  let EPSG_4326 = new OpenLayers.Projection("EPSG:4326"); // lat,lon
  let EPSG_4269 = new OpenLayers.Projection("EPSG:4269"); // NAD 83
  let EPSG_3857 = new OpenLayers.Projection("EPSG:3857"); // WGS 84

  let layerindex = 0;
  let storedLayers = [];
  let groupToggler;

  function layerStoreObj(fileContent, color, fileext, filename, fillOpacity, fontsize, lineopacity, linesize, linestyle, labelpos) {
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
  }

  /*************************************************************************************
   * loadLayers
   *
   * Description:
   * Loads and initializes geometrical layers from local storage into the current map environment. This function retrieves
   * saved layers and processes each one to ensure they are displayed correctly on the map.
   *
   * Behavior:
   * - Checks if any geometrical data is stored in `localStorage` under the key `WMEGeoLayers`.
   * - If present, decompresses and parses the stored string into the `storedLayers` array.
   * - Iterates over each stored layer, applying the `parseFile` function to render them in the map interface.
   * - Initializes `storedLayers` as an empty array if no data is found in local storage.
   * - Logs the loading process in the console for traceability.
   *
   * Notes:
   * - Assumes the existence of the `LZString` library for decompression and the `parseFile` function for layer processing.
   * - Utilizes a global `storedLayers` array to maintain the state of loaded layers throughout the session.
   *********************************************************************************/
  function loadLayers() {
    // Parse any locally stored layer objects
    if (localStorage.WMEGeoLayers != undefined) {
      console.log(`${scriptName}: Loading Saved Layers ...`);
      storedLayers = JSON.parse(LZString.decompress(localStorage.WMEGeoLayers));
      for (layerindex = 0; layerindex < storedLayers.length; ++layerindex) {
        parseFile(storedLayers[layerindex]);
      }
    } else {
      storedLayers = [];
    }
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
  function init() {
    console.log(`${scriptName}: init() called .... Loading User Interface ...`);

    const { tabLabel, tabPane } = W.userscripts.registerSidebarTab("WME Geometries");
    tabLabel.innerText = "GEO";
    W.userscripts.waitForElementConnected(tabPane).then(() => {
      let geobox = document.createElement("div");
      geobox.style.padding = "10px";
      geobox.style.backgroundColor = "#fff";
      geobox.style.border = "2px solid #ddd";
      geobox.style.borderRadius = "10px";
      geobox.style.boxShadow = "2px 2px 10px rgba(0, 0, 0, 0.1)";
      tabPane.appendChild(geobox);

      let geotitle = document.createElement("div"); //legend
      geotitle.innerHTML = GM_info.script.name;
      geotitle.style.textAlign = "center";
      geotitle.style.fontSize = "1.1em";
      geotitle.style.fontWeight = "bold";
      geotitle.style.color = "#222";
      geobox.appendChild(geotitle);

      let geoversion = document.createElement("div");
      geoversion.innerHTML = "v " + GM_info.script.version;
      geoversion.style.textAlign = "center";
      geoversion.style.fontSize = "0.9em";
      geoversion.style.color = "#222";
      geobox.appendChild(geoversion);

      let hr = document.createElement("hr");
      hr.style.marginTop = "5px";
      hr.style.marginBottom = "5px";
      hr.style.border = "0";
      hr.style.borderTop = "1px solid hsl(0, 0%, 93.5%)";
      geobox.appendChild(hr);

      geolist = document.createElement("ul");
      geolist.style.margin = "5px 0";
      geolist.style.padding = "5px";
      geobox.appendChild(geolist);

      let geoform = document.createElement("form");
      geoform.style.display = "flex";
      geoform.style.flexDirection = "column";
      geoform.style.gap = "0px";
      geoform.id = "geoform"; // added for refrance in WKT text Area
      geobox.appendChild(geoform);

      // Create the container div
      let fileContainer = document.createElement("div");
      fileContainer.style.position = "relative";
      fileContainer.style.display = "inline-block";

      // Create the input element
      let inputfile = document.createElement("input");
      inputfile.type = "file";
      inputfile.id = "GeometryFile";
      inputfile.title = ".geojson, .gml or .wkt";

      // Hide the actual input file element
      inputfile.style.opacity = "0";
      inputfile.style.position = "absolute";
      inputfile.style.top = "0";
      inputfile.style.left = "0";
      inputfile.style.width = "100%";
      inputfile.style.height = "100%";
      inputfile.style.cursor = "pointer";
      inputfile.style.pointerEvents = "none"; // Prevents inputfile from capturing events

      // Create the custom label
      let customLabel = document.createElement("label");
      customLabel.htmlFor = "GeometryFile";
      customLabel.innerText = "Import GEO File";
      customLabel.style.padding = "8px 0px";
      customLabel.style.fontSize = "1rem";
      customLabel.style.cursor = "pointer";
      customLabel.style.border = "2px solid #8BC34A"; // Light green border
      customLabel.style.borderRadius = "20px";
      customLabel.style.backgroundColor = "#8BC34A"; // Light green background
      customLabel.style.color = "white";
      customLabel.style.display = "block";
      customLabel.style.width = "100%";
      customLabel.style.boxSizing = "border-box";
      customLabel.style.textAlign = "center";
      customLabel.style.transition = "background-color 0.3s, border-color 0.3s";

      // Add hover effect for custom label
      customLabel.addEventListener("mouseover", function () {
        customLabel.style.backgroundColor = "#689F38"; // Slightly darker green
        customLabel.style.borderColor = "#689F38";
      });

      customLabel.addEventListener("mouseout", function () {
        customLabel.style.backgroundColor = "#8BC34A"; // Original green background
        customLabel.style.borderColor = "#8BC34A";
      });

      // Append the input file and custom label to the container
      fileContainer.appendChild(inputfile);
      fileContainer.appendChild(customLabel);

      // Append the container to the form
      geoform.appendChild(fileContainer);

      // Add change event listener to the input file
      inputfile.addEventListener("change", addGeometryLayer, false);

      let notes = document.createElement("p");
      notes.innerHTML = "<b>Formats:</b> " + formathelp + "<br> <b>Coordinates:</b> EPSG:4326, EPSG:3857";
      notes.style.color = "#555";
      notes.style.display = "block";
      notes.style.fontSize = "0.9em";
      notes.style.marginLeft = "0px";
      notes.style.marginBottom = "0px";
      geoform.appendChild(notes);

      // Creates the State Boubdary Button
      let inputstate = document.createElement("input");
      inputstate.type = "button";
      inputstate.value = "Draw State Boundary";
      inputstate.title = "Draw the Boundary for the State in focus";
      inputstate.style.padding = "8px 0px";
      inputstate.style.fontSize = "1rem";
      inputstate.style.border = "2px solid #87CEEB"; // Light blue border
      inputstate.style.borderRadius = "20px";
      inputstate.style.cursor = "pointer";
      inputstate.style.backgroundColor = "#87CEEB"; // Light blue background
      inputstate.style.color = "white";
      inputstate.style.display = "block";
      inputstate.style.width = "100%";
      inputstate.style.boxSizing = "border-box";
      inputstate.style.textAlign = "center";
      inputstate.style.marginTop = "10px";
      inputstate.style.transition = "background-color 0.3s, border-color 0.3s";

      // Add hover effect for the state boundary button
      inputstate.addEventListener("mouseover", function () {
        inputstate.style.backgroundColor = "#5DADE2"; // Slightly darker blue
        inputstate.style.borderColor = "#5DADE2";
      });

      inputstate.addEventListener("mouseout", function () {
        inputstate.style.backgroundColor = "#87CEEB"; // Original blue background
        inputstate.style.borderColor = "#87CEEB";
      });

      inputstate.addEventListener("click", drawStateBoundary);
      geoform.appendChild(inputstate);

      // Create a container for the color, font size, and fill opacity input fields
      let inputContainer = document.createElement("div");
      inputContainer.style.display = "flex";
      inputContainer.style.flexDirection = "column";
      inputContainer.style.gap = "5px";
      inputContainer.style.marginTop = "10px"; // Add space at the top

      // Adding a horizontal break before Color and Font Size Position
      let hrElement1 = document.createElement("hr");
      hrElement1.style.margin = "5px 0"; // Adjust margin to reduce vertical space
      hrElement1.style.border = "0"; // Remove default border
      hrElement1.style.borderTop = "1px solid #ddd"; // Add custom border
      inputContainer.appendChild(hrElement1);

      // Row for color and font size inputs
      let colorFontSizeRow = document.createElement("div");
      colorFontSizeRow.style.display = "flex";
      colorFontSizeRow.style.justifyContent = "normal";
      colorFontSizeRow.style.alignItems = "center";
      colorFontSizeRow.style.gap = "0px"; // Space between the inputs

      // Color input
      let input_color_label = document.createElement("label");
      input_color_label.setAttribute("for", "color");
      input_color_label.innerHTML = "Color: ";
      input_color_label.style.fontWeight = "normal";
      input_color_label.style.flexShrink = "0"; // Prevent the label from shrinking
      input_color_label.style.marginRight = "5px"; // Add space between the label and input box

      let input_color = document.createElement("input");
      input_color.type = "color";
      input_color.id = "color";
      input_color.value = "#00bfff";
      input_color.name = "color";
      input_color.style.width = "60px"; // Increase the width of the color input

      // Font Size
      let input_font_size_label = document.createElement("label");
      input_font_size_label.setAttribute("for", "font_size");
      input_font_size_label.innerHTML = "Font Size: ";
      input_font_size_label.style.marginLeft = "40px";
      input_font_size_label.style.fontWeight = "normal";
      input_font_size_label.style.flexShrink = "0"; // Prevent the label from shrinking
      input_font_size_label.style.marginRight = "5px"; // Add space between the label and input box

      let input_font_size = document.createElement("input");
      input_font_size.type = "number";
      input_font_size.id = "font_size";
      input_font_size.min = "0";
      input_font_size.max = "20";
      input_font_size.name = "font_size";
      input_font_size.value = "12";
      input_font_size.step = "1.0";
      input_font_size.style.width = "50px"; // Decrease the width of the font size input
      input_font_size.style.textAlign = "center"; // Center the text inside the input box

      // Append elements to the color and font size row
      colorFontSizeRow.appendChild(input_color_label);
      colorFontSizeRow.appendChild(input_color);
      colorFontSizeRow.appendChild(input_font_size_label);
      colorFontSizeRow.appendChild(input_font_size);

      // Append the color and font size row to the input container
      inputContainer.appendChild(colorFontSizeRow);

      // Row for fill opacity input
      let fillOpacityRow = document.createElement("div");
      fillOpacityRow.style.display = "flex";
      fillOpacityRow.style.flexDirection = "column";

      // Polygon Fill Opacity
      let input_fill_opacity_label = document.createElement("label");
      input_fill_opacity_label.setAttribute("for", "fill_opacity");
      input_fill_opacity_label.innerHTML = `Fill Opacity % [${(0.05 * 100).toFixed()}]`;
      input_fill_opacity_label.style.fontWeight = "normal";

      let input_fill_opacity = document.createElement("input");
      input_fill_opacity.type = "range";
      input_fill_opacity.id = "fill_opacity";
      input_fill_opacity.min = "0";
      input_fill_opacity.max = "1";
      input_fill_opacity.step = "0.01";
      input_fill_opacity.value = "0.05";
      input_fill_opacity.name = "fill_opacity";
      input_fill_opacity.style.width = "100%";

      // Apply modern styling to the range input
      input_fill_opacity.style.appearance = "none";
      input_fill_opacity.style.height = "12px";
      input_fill_opacity.style.borderRadius = "5px";
      input_fill_opacity.style.outline = "none";

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

        // Update the background color with opacity
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
      lineStrokeSection.style.display = "flex";
      lineStrokeSection.style.flexDirection = "column";
      lineStrokeSection.style.marginTop = "10px";

      // Line stroke section label
      let lineStrokeSectionLabel = document.createElement("span");
      lineStrokeSectionLabel.innerText = "Line Stroke Settings:";
      lineStrokeSectionLabel.style.fontWeight = "bold";
      lineStrokeSectionLabel.style.marginBottom = "10px";
      lineStrokeSection.appendChild(lineStrokeSectionLabel);

      // Line Stroke Size
      let lineStrokeSizeRow = document.createElement("div");
      lineStrokeSizeRow.style.display = "flex";
      lineStrokeSizeRow.style.alignItems = "center";

      let line_stroke_size_label = document.createElement("label");
      line_stroke_size_label.setAttribute("for", "line_size");
      line_stroke_size_label.innerHTML = "Size:";
      line_stroke_size_label.style.fontWeight = "normal";
      line_stroke_size_label.style.marginRight = "5px";

      let line_stroke_size = document.createElement("input");
      line_stroke_size.type = "number";
      line_stroke_size.id = "line_size";
      line_stroke_size.min = "0";
      line_stroke_size.max = "10";
      line_stroke_size.name = "line_size";
      line_stroke_size.value = "1";
      line_stroke_size.step = ".5";
      line_stroke_size.style.width = "50px";

      lineStrokeSizeRow.appendChild(line_stroke_size_label);
      lineStrokeSizeRow.appendChild(line_stroke_size);

      // Append the line stroke size row to the section container
      lineStrokeSection.appendChild(lineStrokeSizeRow);

      // Line Stroke Style
      let lineStrokeStyleRow = document.createElement("div");
      lineStrokeStyleRow.style.display = "flex";
      lineStrokeStyleRow.style.alignItems = "center";
      lineStrokeStyleRow.style.gap = "10px";
      lineStrokeStyleRow.style.marginTop = "5px";
      lineStrokeStyleRow.style.marginBottom = "5px";

      let line_stroke_types_label = document.createElement("span");
      line_stroke_types_label.innerText = "Style:";
      line_stroke_types_label.style.fontWeight = "normal";
      lineStrokeStyleRow.appendChild(line_stroke_types_label);

      let line_stroke_types = [
        { id: "solid", value: "Solid" },
        { id: "dash", value: "Dash" },
        { id: "dot", value: "Dot" },
      ];
      for (let i = 0; i < line_stroke_types.length; i++) {
        let radioContainer = document.createElement("div");
        radioContainer.style.display = "flex";
        radioContainer.style.alignItems = "center";
        radioContainer.style.gap = "5px";

        let radio = document.createElement("input");
        radio.type = "radio";
        radio.id = line_stroke_types[i].id;
        radio.value = line_stroke_types[i].id;
        radio.name = "line_stroke_style";
        radio.style.margin = "0";
        radio.style.verticalAlign = "middle";

        if (i === 0) {
          // If this is the first radio button, we set it to checked
          radio.checked = true;
        }

        let label = document.createElement("label");
        label.setAttribute("for", radio.id);
        label.innerHTML = line_stroke_types[i].value;
        label.style.fontWeight = "normal";
        label.style.margin = "0"; // Remove default margin
        label.style.lineHeight = "1"; // Ensure the line height matches

        radioContainer.appendChild(radio);
        radioContainer.appendChild(label);

        lineStrokeStyleRow.appendChild(radioContainer);
      }

      // Append the line stroke style row to the section container
      lineStrokeSection.appendChild(lineStrokeStyleRow);

      // Append the line stroke section to the input container
      inputContainer.appendChild(lineStrokeSection);

      // Line Stroke Opacity
      let lineStrokeOpacityRow = document.createElement("div");
      lineStrokeOpacityRow.style.display = "flex";
      lineStrokeOpacityRow.style.flexDirection = "column";

      let line_stroke_opacity_label = document.createElement("label");
      line_stroke_opacity_label.setAttribute("for", "line_stroke_opacity");
      line_stroke_opacity_label.innerHTML = "Opacity % [100]";
      line_stroke_opacity_label.style.fontWeight = "normal";

      let line_stroke_opacity = document.createElement("input");
      line_stroke_opacity.type = "range";
      line_stroke_opacity.id = "line_stroke_opacity";
      line_stroke_opacity.min = "0";
      line_stroke_opacity.max = "1";
      line_stroke_opacity.step = ".05";
      line_stroke_opacity.value = "1";
      line_stroke_opacity.name = "line_stroke_opacity";
      line_stroke_opacity.style.width = "100%";

      // Apply modern styling to the range input
      line_stroke_opacity.style.appearance = "none";
      line_stroke_opacity.style.height = "12px";
      line_stroke_opacity.style.borderRadius = "5px";
      line_stroke_opacity.style.outline = "none";

      // Initialize with input color's current value
      let updateLineOpacityInputStyles = () => {
        let color = input_color.value;
        let opacityValue = line_stroke_opacity.value;
        let rgbaColor = `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, ${opacityValue})`;
        line_stroke_opacity.style.backgroundColor = rgbaColor;
        line_stroke_opacity.style.border = `2px solid ${color}`;
      };

      updateLineOpacityInputStyles();

      // Event listener to update the label dynamically
      line_stroke_opacity.addEventListener("input", function () {
        line_stroke_opacity_label.innerHTML = `Opacity % [${Math.round(this.value * 100)}]`;
        updateLineOpacityInputStyles();
      });
      // Add an event listener to update styles when color input changes
      input_color.addEventListener("input", () => {
        updateOpacityInputStyles();
        updateLineOpacityInputStyles();
      });

      lineStrokeOpacityRow.appendChild(line_stroke_opacity_label);
      lineStrokeOpacityRow.appendChild(line_stroke_opacity);

      // Append the line stroke opacity row to the input container
      inputContainer.appendChild(lineStrokeOpacityRow);

      // Adding a horizontal break before Label Position
      let hrElement2 = document.createElement("hr");
      hrElement2.style.margin = "5px 0"; // Adjust margin to reduce vertical space
      hrElement2.style.border = "0"; // Remove default border
      hrElement2.style.borderTop = "1px solid #ddd"; // Add custom border
      inputContainer.appendChild(hrElement2);

      // Section for label position
      let labelPositionSection = document.createElement("div");
      labelPositionSection.style.display = "flex";
      labelPositionSection.style.flexDirection = "column";

      // Label position section label
      let labelPositionSectionLabel = document.createElement("span");
      labelPositionSectionLabel.innerText = "Label Position Settings:";
      labelPositionSectionLabel.style.fontWeight = "bold";
      labelPositionSectionLabel.style.marginBottom = "5px";
      labelPositionSection.appendChild(labelPositionSectionLabel);

      // Container for horizontal and vertical positioning options
      let labelPositionContainer = document.createElement("div");
      labelPositionContainer.style.display = "flex";
      labelPositionContainer.style.marginLeft = "10px";
      labelPositionContainer.style.gap = "80px";

      // Column for horizontal alignment
      let horizontalColumn = document.createElement("div");
      horizontalColumn.style.display = "flex";
      horizontalColumn.style.flexDirection = "column";
      horizontalColumn.style.gap = "5px";

      let horizontalLabel = document.createElement("span");
      horizontalLabel.innerText = "Horizontal:";
      horizontalLabel.style.fontWeight = "normal";
      horizontalColumn.appendChild(horizontalLabel);

      let label_pos_horizontal = [
        { id: "l", value: "Left" },
        { id: "c", value: "Center" },
        { id: "r", value: "Right" },
      ];
      for (let i = 0; i < label_pos_horizontal.length; i++) {
        let radioHorizontalRow = document.createElement("div");
        radioHorizontalRow.style.display = "flex";
        radioHorizontalRow.style.alignItems = "center";
        radioHorizontalRow.style.gap = "5px"; // Smaller space between radio and label

        let radio = document.createElement("input");
        radio.type = "radio";
        radio.id = label_pos_horizontal[i].id;
        radio.value = label_pos_horizontal[i].id;
        radio.name = "label_pos_horizontal";
        radio.style.margin = "0"; // Remove default margin
        radio.style.verticalAlign = "middle"; // Center align radios with text

        let label = document.createElement("label");
        label.setAttribute("for", radio.id);
        label.innerHTML = label_pos_horizontal[i].value;
        label.style.fontWeight = "normal";
        label.style.margin = "0"; // Remove default margin
        label.style.lineHeight = "1"; // Ensure the line height matches

        if (radio.id === "c") {
          // If this is the first radio button, we set it to checked
          radio.checked = true;
        }

        radioHorizontalRow.appendChild(radio);
        radioHorizontalRow.appendChild(label);
        horizontalColumn.appendChild(radioHorizontalRow);
      }

      // Column for vertical alignment
      let verticalColumn = document.createElement("div");
      verticalColumn.style.display = "flex";
      verticalColumn.style.flexDirection = "column";
      verticalColumn.style.gap = "5px";

      let verticalLabel = document.createElement("span");
      verticalLabel.innerText = "Vertical:";
      verticalLabel.style.fontWeight = "normal";
      verticalColumn.appendChild(verticalLabel);

      let label_pos_vertical = [
        { id: "t", value: "Top" },
        { id: "m", value: "Middle" },
        { id: "b", value: "Bottom" },
      ];
      for (let i = 0; i < label_pos_vertical.length; i++) {
        let radioVerticalRow = document.createElement("div");
        radioVerticalRow.style.display = "flex";
        radioVerticalRow.style.alignItems = "center";
        radioVerticalRow.style.gap = "5px";

        let radio = document.createElement("input");
        radio.type = "radio";
        radio.id = label_pos_vertical[i].id;
        radio.value = label_pos_vertical[i].id;
        radio.name = "label_pos_vertical";
        radio.style.margin = "0"; // Remove default margin
        radio.style.verticalAlign = "middle"; // Center align radios with text

        let label = document.createElement("label");
        label.setAttribute("for", radio.id);
        label.innerHTML = label_pos_vertical[i].value;
        label.style.fontWeight = "normal";
        label.style.margin = "0"; // Remove default margin
        label.style.lineHeight = "1"; // Ensure the line height matches

        if (radio.id === "m") {
          // If this is the first radio button, we set it to checked
          radio.checked = true;
        }

        radioVerticalRow.appendChild(radio);
        radioVerticalRow.appendChild(label);
        verticalColumn.appendChild(radioVerticalRow);
      }

      // Append columns to the label position container
      labelPositionContainer.appendChild(horizontalColumn);
      labelPositionContainer.appendChild(verticalColumn);

      // Append the label position container to the label position section
      labelPositionSection.appendChild(labelPositionContainer);

      // Append the label position section to the input container
      inputContainer.appendChild(labelPositionSection);

      // Append the input container to the form
      geoform.appendChild(inputContainer);

      // Adding a horizontal break before the WKT input section
      let hrElement3 = document.createElement("hr");
      hrElement3.style.margin = "10px 0"; // Adjust margin to reduce vertical space
      hrElement3.style.border = "0"; // Remove default border
      hrElement3.style.borderTop = "1px solid #ddd"; // Add custom border
      geoform.appendChild(hrElement3);

      // New label for the Text Area for WKT input section
      let wktSectionLabel = document.createElement("div");
      wktSectionLabel.innerHTML = 'WKT Input: (<a href="https://en.wikipedia.org/wiki/Well-known_text_representation_of_geometry" target="_blank">WKT Format</a> )';
      wktSectionLabel.style.fontWeight = "bold";
      wktSectionLabel.style.marginBottom = "5px";
      wktSectionLabel.style.display = "block";
      geoform.appendChild(wktSectionLabel);
      // Text Area for WKT input
      let wktContainer = document.createElement("div");
      wktContainer.style.display = "flex";
      wktContainer.style.flexDirection = "column";
      wktContainer.style.gap = "5px";
      // Input for WKT Name
      let input_WKT_name = document.createElement("input");
      input_WKT_name.type = "text";
      input_WKT_name.id = "input_WKT_name";
      input_WKT_name.name = "input_WKT_name";
      input_WKT_name.placeholder = "Name of WKT";
      input_WKT_name.style.padding = "8px";
      input_WKT_name.style.fontSize = "1rem";
      input_WKT_name.style.border = "2px solid #ddd";
      input_WKT_name.style.borderRadius = "5px";
      input_WKT_name.style.width = "100%";
      input_WKT_name.style.boxSizing = "border-box";
      wktContainer.appendChild(input_WKT_name);

      // Text Area for WKT input
      let input_WKT = document.createElement("textarea");
      input_WKT.id = "input_WKT";
      input_WKT.name = "input_WKT";
      input_WKT.placeholder = "POINT(X Y)  LINESTRING (X Y, X Y,...)  POLYGON(X Y, X Y, X Y,...) etc....";
      input_WKT.style.width = "100%";
      input_WKT.style.height = "10rem";
      input_WKT.style.padding = "8px";
      input_WKT.style.fontSize = "1rem";
      input_WKT.style.border = "2px solid #ddd";
      input_WKT.style.borderRadius = "5px";
      input_WKT.style.boxSizing = "border-box";
      input_WKT.style.resize = "vertical"; // Limit resizing to vertical only
      wktContainer.appendChild(input_WKT);

      // Container for the buttons
      let buttonContainer = document.createElement("div");
      buttonContainer.style.display = "flex";
      buttonContainer.style.gap = "45px";

      // Add the Import WKT Button
      let submit_WKT_btn = document.createElement("input");
      submit_WKT_btn.type = "button";
      submit_WKT_btn.id = "submit_WKT_btn";
      submit_WKT_btn.value = "Import WKT";
      submit_WKT_btn.title = "Import WKT Geometry to WME Layer";
      submit_WKT_btn.style.padding = "8px 20px";
      submit_WKT_btn.style.fontSize = "1rem";
      submit_WKT_btn.style.border = "2px solid #8BC34A"; // Light green border
      submit_WKT_btn.style.borderRadius = "20px";
      submit_WKT_btn.style.cursor = "pointer";
      submit_WKT_btn.style.backgroundColor = "#8BC34A"; // Light green background
      submit_WKT_btn.style.color = "white";
      submit_WKT_btn.style.boxSizing = "border-box";
      submit_WKT_btn.style.transition = "background-color 0.3s, border-color 0.3s";
      // Add hover effect for submit button
      submit_WKT_btn.addEventListener("mouseover", function () {
        submit_WKT_btn.style.backgroundColor = "#689F38"; // Darker green background on hover
        submit_WKT_btn.style.borderColor = "#689F38"; // Darker green border on hover
      });

      submit_WKT_btn.addEventListener("mouseout", function () {
        submit_WKT_btn.style.backgroundColor = "#8BC34A"; // Original green background
        submit_WKT_btn.style.borderColor = "#8BC34A"; // Original green border
      });

      submit_WKT_btn.addEventListener("click", draw_WKT);
      buttonContainer.appendChild(submit_WKT_btn);

      // Add the Clear WKT Button
      let clear_WKT_btn = document.createElement("input");
      clear_WKT_btn.type = "button";
      clear_WKT_btn.id = "clear_WKT_btn";
      clear_WKT_btn.value = "Clear WKT";
      clear_WKT_btn.title = "Clear WKT Geometry Input and Name";
      clear_WKT_btn.style.padding = "8px 20px";
      clear_WKT_btn.style.fontSize = "1rem";
      clear_WKT_btn.style.border = "2px solid #E57373"; // Light red border
      clear_WKT_btn.style.borderRadius = "20px";
      clear_WKT_btn.style.cursor = "pointer";
      clear_WKT_btn.style.backgroundColor = "#E57373"; // Light red background
      clear_WKT_btn.style.color = "white";
      clear_WKT_btn.style.boxSizing = "border-box";
      clear_WKT_btn.style.transition = "background-color 0.3s, border-color 0.3s";
      // Add hover effect for clear button
      clear_WKT_btn.addEventListener("mouseover", function () {
        clear_WKT_btn.style.backgroundColor = "#D32F2F"; // Darker red background
        clear_WKT_btn.style.borderColor = "#D32F2F";
      });

      clear_WKT_btn.addEventListener("mouseout", function () {
        clear_WKT_btn.style.backgroundColor = "#E57373"; // Original red background
        clear_WKT_btn.style.borderColor = "#E57373";
      });

      clear_WKT_btn.addEventListener("click", clear_WKT_input);
      buttonContainer.appendChild(clear_WKT_btn);

      wktContainer.appendChild(buttonContainer);

      // Append the container to the form
      geoform.appendChild(wktContainer);

      console.log(`${scriptName}: User Interface Loaded!`);
      // Log the OpenLayers version
      if (OpenLayers.VERSION_NUMBER) {
        if (debug) console.log(`${scriptName}: OpenLayers Version: ${OpenLayers.VERSION_NUMBER}`);
      }

      loadLayers();
    });
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
    // use wicket.js for all WKT as it is a more stable parser then the curren OpenLayer Version in WME
    if (debug) console.log(`${scriptName}:  draw_WKT() from User Input called`);

    // Add variables from Options input section to WKT input geo
    let color = document.getElementById("color").value;
    let fillOpacity = document.getElementById("fill_opacity").value;
    let fontsize = document.getElementById("font_size").value;
    let lineopacity = document.getElementById("line_stroke_opacity").value;
    let linesize = document.getElementById("line_size").value;
    let linestyle = document.querySelector('input[name="line_stroke_style"]:checked').value;
    let layerName = document.getElementById("input_WKT_name").value;
    let labelpos = document.querySelector('input[name="label_pos_horizontal"]:checked').value + document.querySelector('input[name="label_pos_vertical"]:checked').value;

    // Check for duplicate layer name
    let layers = W.map.getLayersBy("layerGroup", "wme_geometry");
    for (let i = 0; i < layers.length; i++) {
      if (layers[i].name === "Geometry: " + layerName) {
        if (debug) console.error(`${scriptName}: current WKT layer name already used`);
        WazeWrap.Alerts.error(scriptName, "Current WKT layer name already used!");
        return;
      }
    }
    let val_from_WKT_textarea = document.getElementById("input_WKT").value;
    if (val_from_WKT_textarea.trim() === "") {
      if (debug) console.error(`${scriptName}: WKT input is empty.`);
      WazeWrap.Alerts.error(scriptName, "WKT input is empty.");
      return;
    }
    // Using the Wkt.js library to parse the WKT
    let wktObj = formats["WKT"];
    try {
      wktObj.read(val_from_WKT_textarea);
      if (debug) console.info(`${scriptName}: WKT input successfuly read:`, wktObj);
    } catch (error) {
      if (debug) console.error(`${scriptName}: Error parsing WKT. Please check your input format.`, error);
      WazeWrap.Alerts.error(scriptName, "Error parsing WKT. Please check your input format.");
      return;
    }
    // Convert WKT to GeoJSON
    let geojsonData;
    try {
      let geometry = wktObj.toJson();
      geojsonData = {
        type: "Feature",
        geometry: geometry,
        properties: {
          Name: layerName,
        },
      };

      if (debug) console.info(`${scriptName}: WKT input successfuly converted to geoJSON`, geojsonData);
    } catch (error) {
      if (debug) console.error(`${scriptName}:  Error converting WKT to GeoJSON`, error);
      WazeWrap.Alerts.error(scriptName, "Error converting WKT to GeoJSON");
      return;
    }
    // Construct and store the layer object
    let geojson_to_layer_obj = new layerStoreObj(geojsonData, color, "GEOJSON", layerName, fillOpacity, fontsize, lineopacity, linesize, linestyle, labelpos);
    storedLayers.push(geojson_to_layer_obj);

    // Add the layer to the map and parse
    try {
      parseFile(geojson_to_layer_obj);
    } catch (error) {
      if (debug) console.error(`${scriptName}: Error adding layer to map:`, error);
      return;
    }
    // Compressed storage in localStorage
    try {
      localStorage.WMEGeoLayers = LZString.compress(JSON.stringify(storedLayers));
    } catch (error) {
      if (debug) console.error(`${scriptName}: Error saving to localStorage`, error);
      return;
    }
    console.info(`${scriptName}: Stored WKT Input - ${layerName} : ${localStorage.WMEGeoLayers.length / 1000} kB in localStorage`);
  }

  /*******************************************************************************
   * drawStateBoundary
   *
   * Description:
   * This function draws the boundary of the currently selected state on the map, using specific styling options
   * provided by the user. It checks for the existence of the state boundary data, ensures that it’s not already
   * loaded, and then processes it into a geometrically styled layer.
   *
   * Parameters:
   * - No direct parameters; relies on DOM elements and global objects for inputs and operations.
   *
   * Behavior:
   * - Extracts styling options from DOM input elements for color, opacity, font size, line style, and label position.
   * - Checks if the state and its geometry data are available in the global WME (Waze Map Editor) model.
   * - Verifies whether the state’s geometric boundary is already loaded on the map to prevent duplication.
   * - Constructs a `layerStoreObj` with the state’s geometry data serialized to a GeoJSON format along with styling.
   * - Calls `parseFile` to create and add the state boundary as a new map layer.
   * - Updates localStorage with the compressed state geometry data, maintaining persistence across sessions.
   *
   * Notes:
   * - Utilizes global variables such as `W.map`, `W.model`, and `storedLayers`, which must be pre-defined.
   * - Provides user feedback through console logs and UI alerts, especially when the state data is unavailable or already loaded.
   * - Debug logging is conditional based on the `debug` flag to assist in development and troubleshooting.
   *****************************************************************************/
  function drawStateBoundary() {
    if (debug) console.info(`${scriptName}: drawStateBoundary() called`);
    // add formating Options and locaal storage for WME refresh availability to Draw State Boundary functionality
    let color = document.getElementById("color").value;
    let fillOpacity = document.getElementById("fill_opacity").value;
    let fontsize = document.getElementById("font_size").value;
    let lineopacity = document.getElementById("line_stroke_opacity").value;
    let linesize = document.getElementById("line_size").value;
    let linestyle = document.querySelector('input[name="line_stroke_style"]:checked').value;
    let labelpos = document.querySelector('input[name="label_pos_horizontal"]:checked').value + document.querySelector('input[name="label_pos_vertical"]:checked').value;

    if (!W.model.topState || !W.model.topState.attributes || !W.model.topState.attributes.geometry) {
      if (debug) console.info(`${scriptName}: no state or geometry available, sorry!`);
      WazeWrap.Alerts.info(scriptName, "No State or Geometry Available, Sorry!");
      return;
    }
    let layerName = `(${W.model.topState.attributes.name})`.replace(/[^A-Za-z]/g, "");
    if (debug) console.info(`${scriptName}: State or geometry is:`, layerName);

    let layers = W.map.getLayersBy("layerGroup", "wme_geometry");
    for (let i = 0; i < layers.length; i++) {
      if (layers[i].name == "Geometry: " + layerName) {
        if (debug) console.info(`${scriptName}: current state already loaded`);
        WazeWrap.Alerts.info(scriptName, "Current State Boundary already Loaded!");
        return;
      }
    }

    let state_geo = W.model.topState.attributes.geometry;
    // Convert to GeoJSON
    let state_geojson;
    try {
      state_geojson = {
        type: "Feature",
        geometry: state_geo,
        properties: {
          Name: layerName,
        },
      };
    } catch (error) {
      if (debug) console.error(`${scriptName}:  Error converting topState.attributes.geometry to GeoJSON`, error);
      WazeWrap.Alerts.error(scriptName, "Error converting topState.attributes.geometry to GeoJSON");
      return;
    }

    let state_obj = new layerStoreObj(state_geojson, color, "GEOJSON", layerName, fillOpacity, fontsize, lineopacity, linesize, linestyle, labelpos);
    storedLayers.push(state_obj);

    if (debug) console.info(`${scriptName}: State _obj:`, state_obj);
    parseFile(state_obj);
    localStorage.WMEGeoLayers = LZString.compress(JSON.stringify(storedLayers));
    console.info(`${scriptName}: Stored the State of ${layerName} : ${localStorage.WMEGeoLayers.length / 1000} kB in localStorage`);
  }

  // Clears the current contents of the textarea.
  function clear_WKT_input() {
    document.getElementById("input_WKT").value = "";
    document.getElementById("input_WKT_name").value = "";
  }

  /*************************************************************************
   * addGeometryLayer
   *
   * Description:
   * Facilitates the addition of a new geometry layer to the map by reading a user-selected file, parsing its contents,
   * and configuring the layer with specified styling options. The function also updates UI elements and handles storage
   * of the layer information.
   *
   * Parameters:
   * - This function does not take explicit parameters, but it relies on DOM elements for file input and styling options.
   *
   * Behavior:
   * - Retrieves a file from the user's input and extracts necessary metadata such as the filename and file extension.
   * - Gathers styling options from the DOM input elements (e.g., color, opacity, line style).
   * - Sanitizes and prepares a list item in the UI to reflect the status of the file processing.
   * - Validates file format support and utilizes a `FileReader` to process the file asynchronously.
   * - Handles WKT files by reading each line as individual geometries and converting them to separate GeoJSON features.
   *   Creates a GeoJSON FeatureCollection with each line represented as distinctive features for flexible layer manipulation.
   * - Constructs a `fileObj` with all necessary data and style properties for each geometry, encapsulating each converted
   *   feature into the feature collection.
   * - Parses the file object through `parseFile` to create visual layers on the map for each feature.
   * - Updates local storage with compressed data for persistence of the newly added layers.
   *
   * Notes:
   * - Depends on the accurate setup of global context variables and elements like `geolist` and `storedLayers` for successful execution.
   * - Provides extensive logging details if the `debug` flag is enabled, aiding in the troubleshooting and validation process.
   *************************************************************************/
  function addGeometryLayer() {
    if (debug) console.log(`${scriptName}: addGeometryLayer() called`);

    let fileList = document.getElementById("GeometryFile");
    let file = fileList.files[0];
    fileList.value = "";
    let fileext = file.name.split(".").pop();
    let filename = file.name.replace("." + fileext, "");
    fileext = fileext.toUpperCase();

    // Add variables from Options input section
    let color = document.getElementById("color").value;
    let fillOpacity = document.getElementById("fill_opacity").value;
    let fontsize = document.getElementById("font_size").value;
    let lineopacity = document.getElementById("line_stroke_opacity").value;
    let linesize = document.getElementById("line_size").value;
    let linestyle = document.querySelector('input[name="line_stroke_style"]:checked').value;
    let labelpos = document.querySelector('input[name="label_pos_horizontal"]:checked').value + document.querySelector('input[name="label_pos_vertical"]:checked').value;

    let fileitem = document.getElementById(filename.replace(/[^a-z0-9_-]/gi, "_"));
    if (!fileitem) {
      fileitem = document.createElement("li");
      fileitem.id = filename.replace(/[^a-z0-9_-]/gi, "_");

      // Style the list item
      fileitem.style.position = "relative";
      fileitem.style.padding = "2px 2px";
      fileitem.style.margin = "2px 0"; // Adjust margin to be smaller
      fileitem.style.background = "transparent";
      fileitem.style.borderRadius = "3px";
      fileitem.style.display = "flex";
      fileitem.style.justifyContent = "space-between";
      fileitem.style.alignItems = "center";
      fileitem.style.transition = "background 0.2s";
      fileitem.style.fontSize = "0.95em";

      // Add hover effect
      fileitem.addEventListener("mouseover", function () {
        fileitem.style.background = "#eaeaea";
      });
      fileitem.addEventListener("mouseout", function () {
        fileitem.style.background = "transparent";
      });

      geolist.appendChild(fileitem);
    }

    let fileText = document.createElement("span");
    fileText.style.color = color;
    fileText.innerHTML = "Loading...";
    fileText.style.flexGrow = "1";
    fileText.style.lineHeight = "1";
    fileText.style.fontSize = "0.95em";
    fileitem.appendChild(fileText);

    // Remove button
    let removeButton = document.createElement("button");
    removeButton.style.cursor = "pointer";
    removeButton.style.backgroundColor = "#E57373"; // Light red background
    removeButton.style.color = "white";
    removeButton.style.border = "none";
    removeButton.style.padding = "0px 0px 0px 0px"; // Adjust padding to be smaller
    removeButton.style.borderRadius = "3px";
    removeButton.innerHTML = "X";
    removeButton.style.fontSize = "1.0em";
    removeButton.style.width = "16px"; // Make button square
    removeButton.style.height = "16px"; // Make button square
    removeButton.style.marginLeft = "3px"; // Add some spacing from the text
    removeButton.addEventListener("click", () => removeGeometryLayer(filename));
    fileitem.appendChild(removeButton);

    // Check if format is supported
    let parser = formats[fileext];
    if (typeof parser == "undefined") {
      fileitem.innerHTML = fileext + " format not supported :(";
      fileitem.style.color = "red";
      return;
    }

    let reader = new FileReader();
    reader.onload = (function (theFile) {
      return function (e) {
        requestAnimationFrame(() => {
          let fileObj;

          // Process to convert WKT files into a GeoJSON format with each line as a separate feature.
          if (fileext === "WKT") {
            if (debug) console.log(`${scriptName}: WKT file detected, converting each line to individual GeoJSON features...`);

            let wktContent = e.target.result;
            let wktLines = wktContent
              .split("\n")
              .map((line) => line.trim())
              .filter((line) => line.length > 0);

            if (wktLines.length === 0) {
              return;
            }

            let features = []; // To hold each GeoJSON feature

            // Process each WKT line into separate GeoJSON features
            wktLines.forEach((line, index) => {
              let wktObj = new Wkt.Wkt();
              try {
                wktObj.read(line);
                let geoJsonGeometry = wktObj.toJson();
                let feature = {
                  type: "Feature",
                  geometry: geoJsonGeometry,
                  properties: {
                    name: `${filename}`, // Naming feature based on file name and index
                  },
                };
                features.push(feature); // Add the feature to the features array
              } catch (error) {
                console.error(`${scriptName}: Error parsing WKT line:`, line, error);
              }
            });

            // Create a GeoJSON FeatureCollection with all features
            let geojsonData = {
              type: "FeatureCollection",
              features: features,
            };

            if (debug) console.log(`${scriptName}: All WKT lines converted to separate GeoJSON features:`, geojsonData);
            fileObj = new layerStoreObj(geojsonData, color, "GEOJSON", filename, fillOpacity, fontsize, lineopacity, linesize, linestyle, labelpos);
          } else {
            fileObj = new layerStoreObj(e.target.result, color, fileext, filename, fillOpacity, fontsize, lineopacity, linesize, linestyle, labelpos);
          }

          // Add the resulting object to stored layers and update map.
          storedLayers.push(fileObj);
          parseFile(fileObj);
          localStorage.WMEGeoLayers = LZString.compress(JSON.stringify(storedLayers));
          console.info(`${scriptName}: stored file - ${fileitem.id} : ${localStorage.WMEGeoLayers.length / 1000} kB in localStorage`);
        });
      };
    })(file);
    reader.readAsText(file);
  }

  /*************************************************************************************
   * parseFile
   *
   * Description:
   * This function processes a file object containing geographic data, formats and styles it, and adds it as a vector layer
   * to the map. It updates the User Interface (UI) with a list item reflecting the file's loading status and handles
   * additional label formatting based on the file's attributes.
   *
   * Parameters:
   * @param {Object} fileObj - An object containing the data and metadata of the file to be parsed.
   *   - {string} fileObj.filename - Name of the file.
   *   - {string} fileObj.fileext - File extension used to determine the parser to use.
   *   - {string} fileObj.fileContent - The content of the file.
   *   - {string} fileObj.color - Color setting for layer styling.
   *   - {number} fileObj.lineopacity, fileObj.linesize, fileObj.linestyle - Line styling settings.
   *   - {number} fileObj.fillOpacity - Opacity setting for filled areas.
   *   - {number} fileObj.fontsize - Font size for labeling.
   *   - {string} fileObj.labelpos - Anchor position for labels.
   *
   * Behavior:
   * - Logs debug information if debugging is enabled.
   * - Configures style settings for the vector layer based on the properties of `fileObj`.
   * - Determines parser based on the file's extension and sets the projection accordingly.
   * - Parses the file content and extracts features, handling errors by logging them.
   * - Evaluates feature attributes to find a label attribute if the number of features allows it.
   * - Creates and styles a vector layer, adds it to the map, and manages labeling.
   * - Updates or creates a corresponding list item in the UI to reflect file loading status.
   * - Utilizes the global context including `W.map` for map operations and `geolist` for UI operations.
   ***************************************************************************************/
  function parseFile(fileObj) {
    if (debug) console.log(`${scriptName}: parseFile(fileObj) called`);

    if (debug) console.log(`${scriptName}: fileObj:`, fileObj);

    let layerStyle = {
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
      //labelXOffset: 0,
      //labelYOffset: 0,
      label: "${formatLabel}", // Your existing label formatting function
      //pathLabel: "${formatLabel}", // Attempt path labeling
      //pathLabelCurve: true, // Use the curve flag for path following
      //pathLabelReadable: true, // Ensures label is readable without inversion
    };

    let fileext = fileObj.fileext.toUpperCase();
    let fileContent = fileObj.fileContent;
    let filename = fileObj.filename;
    let parser = formats[fileext]; // Ensure extension is uppercase for consistency

    if (!parser) {
      console.error(`${scriptName}: No parser found for format: ${fileext}`);
      return;
    }

    parser.internalProjection = W.map.getProjectionObject();
    parser.externalProjection = EPSG_4326;

    if (/"EPSG:3857"/.test(fileContent) || /:EPSG::3857"/.test(fileContent)) {
      parser.externalProjection = EPSG_3857;
    } else if (/"EPSG:4269"/.test(fileContent) || /:EPSG::4269"/.test(fileContent)) {
      parser.externalProjection = EPSG_4269;
    }

    let features;
    try {
      features = parser.read(fileContent);
    } catch (error) {
      console.error(`${scriptName}: Error parsing file content for ${filename}:`, error);
      return; // Exit the function if parsing fails
    }

    let labelwith = "(no labels)";
    let labelAttribute = "";

    // Declare WME_Geometry outside of the conditional block
    let WME_Geometry;

    // Check if there are any features
    if (features.length > 0) {
      // Log the total number of features
      if (debug) console.log(`${scriptName}: Number of features: ${features.length}`);

      // Check if the number of features is within the label limit
      if (features.length <= maxlabels) {
        if (debug) console.log(`${scriptName}: Processing features for labeling, within max labels limit: ${maxlabels}`);

        // Iterate over each attribute of the first feature
        for (let attrib in features[0].attributes) {
          // Log the current attribute being evaluated
          if (debug) console.log(`${scriptName}: Evaluating attribute '${attrib}' for labeling`);

          // Test if the attribute matches the label name pattern
          if (labelname.test(attrib.toLowerCase())) {
            if (debug) console.log(`${scriptName}: Attribute '${attrib}' matches label pattern`);

            // Check if the attribute value is a string
            if (typeof features[0].attributes[attrib] === "string") {
              if (debug) console.log(`${scriptName}: Attribute '${attrib}' is a string, and will be used for object labels`);

              labelwith = "Attribute used for Labels: " + attrib;
              labelAttribute = attrib;

              break;
            } else {
              if (debug) console.log(`${scriptName}: Attribute '${attrib}' is NOT a string type`);
            }
          } else {
            // Log if the attribute does not match
            if (debug) console.log(`${scriptName}: Attribute '${attrib}' does not match the label pattern`);
          }
        }
      } else {
        // Log if the number of features exceeds the max label limit
        if (debug) console.log(`${scriptName}: Features exceed max labels limit, no labeling applied: ${maxlabels}`);
      }
      let labelContext = {
        formatLabel: function (feature) {
          if (labelAttribute && feature.attributes.hasOwnProperty(labelAttribute)) {
            let labelValue = feature.attributes[labelAttribute];
            labelValue = labelValue.replace(/\|/g, "\n");
            return labelValue;
          } else {
            return "";
          }
        },
      };

      let defaultStyle = new OpenLayers.Style(layerStyle, { context: labelContext });

      let layerid = "wme_geometry_" + layerindex;
      WME_Geometry = new OpenLayers.Layer.Vector("Geometry: " + filename, {
        rendererOptions: { zIndexing: true },
        uniqueName: layerid,
        layerGroup: "wme_geometry",
      });

      WME_Geometry.setZIndex(-9999);
      I18n.translations[I18n.locale].layers.name[layerid] = "WME Geometries: " + filename;
      WME_Geometry.styleMap = new OpenLayers.StyleMap(defaultStyle);
      WME_Geometry.addFeatures(features);

      if (debug) console.log(`${scriptName}: New WME_Geometry Object:`, WME_Geometry);
      if (!groupToggler) {
        groupToggler = addGroupToggler(false, "layer-switcher-group_wme_geometries", "WME Geometries");
      }
      addLayerToggler(groupToggler, filename, WME_Geometry);
      W.map.addLayer(WME_Geometry); // Addes new Layer to WME
    }

    let liObj = document.getElementById(filename.replace(/[^a-z0-9_-]/gi, "_"));
    if (!liObj) {
      liObj = document.createElement("li");
      liObj.id = filename.replace(/[^a-z0-9_-]/gi, "_");

      // Style the list item
      liObj.style.position = "relative";
      liObj.style.padding = "2px 2px";
      liObj.style.margin = "2px 0"; // Adjust margin to be smaller
      liObj.style.background = "transparent";
      liObj.style.borderRadius = "3px";
      liObj.style.display = "flex";
      liObj.style.justifyContent = "space-between";
      liObj.style.alignItems = "center";
      liObj.style.transition = "background 0.2s";
      liObj.style.fontSize = "0.95em";

      // Add hover effect
      liObj.addEventListener("mouseover", function () {
        liObj.style.background = "#eaeaea";
      });
      liObj.addEventListener("mouseout", function () {
        liObj.style.background = "transparent";
      });

      let span = document.createElement("span");
      span.style.color = fileObj.color;
      span.innerHTML = "Loading...";
      span.style.flexGrow = "1";
      span.style.lineHeight = "1";
      span.style.fontSize = "0.95em";
      liObj.appendChild(span);

      // Remove button
      let removeButton = document.createElement("button");
      removeButton.style.cursor = "pointer";
      removeButton.style.backgroundColor = "#E57373"; // Light red background
      removeButton.style.color = "white";
      removeButton.style.border = "none";
      removeButton.style.padding = "0px 0px 0px 0px";
      removeButton.style.borderRadius = "3px";
      removeButton.innerHTML = "X";
      removeButton.style.fontSize = "1.0em";
      removeButton.style.width = "16px";
      removeButton.style.height = "16px";
      removeButton.style.marginLeft = "3px";
      removeButton.addEventListener("click", () => removeGeometryLayer(filename));
      liObj.appendChild(removeButton);

      geolist.appendChild(liObj);
    }

    requestAnimationFrame(() => {
      let spanObj = liObj.querySelector("span");
      if (features.length === 0) {
        spanObj.innerHTML = "No features loaded :(";
        spanObj.style.color = "red";
        if (WME_Geometry) {
          WME_Geometry.destroy();
        }
      } else {
        spanObj.innerHTML = filename;
        spanObj.title = `${fileext} ${parser.externalProjection.projCode}: ${features.length} features loaded\n${labelwith}`;
        console.info(`${scriptName}: Loaded ${filename}.${fileext} ${parser.externalProjection.projCode}: ${features.length} features loaded\n${labelwith}`);
      }
    });

    if (debug) console.log(`${scriptName}: parseFile(fileObj) Finished!`);
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
  function removeGeometryLayer(filename) {
    if (debug) {
      console.log(`${scriptName}: removeGeometryLayer() called for (${filename})`);
    }

    const layerName = `Geometry: ${filename}`;
    const layers = W.map.getLayersBy("layerGroup", "wme_geometry");
    const layerToDestroy = layers.find((layer) => layer.name === layerName);

    if (!layerToDestroy) {
      console.info(`${scriptName}: No layer found for (${filename})`);
      return;
    }

    // Destroy the layer
    layerToDestroy.destroy();

    // Update storedLayers by filtering out the removed layer
    storedLayers = storedLayers.filter((layer) => layer.filename !== filename);

    // Sanitize filename and define IDs
    const listItemId = filename.replace(/[^a-z0-9_-]/gi, "_");
    const layerTogglerId = `t_${listItemId}`;

    // Remove the toggler item if it exists
    const togglerItem = document.getElementById(layerTogglerId);
    if (togglerItem?.parentElement) {
      togglerItem.parentElement.removeChild(togglerItem);
    }

    const initialLocalStorageSize = localStorage.WMEGeoLayers ? localStorage.WMEGeoLayers.length / 1000 : 0;

    // Update local storage based on the remaining layers
    if (storedLayers.length === 0) {
      localStorage.removeItem("WMEGeoLayers");
      storedLayers = [];
    } else {
      localStorage.WMEGeoLayers = LZString.compress(JSON.stringify(storedLayers));
    }

    const newLocalStorageSize = localStorage.WMEGeoLayers ? localStorage.WMEGeoLayers.length / 1000 : 0;
    const sizeChange = newLocalStorageSize - initialLocalStorageSize;

    console.info(`${scriptName}: Removed file (${filename}). Storage size changed by ${sizeChange}kB. Total size is now ${newLocalStorageSize}kB.`);

    // Remove any list item using the listItemId
    const listItem = document.getElementById(listItemId);
    if (listItem) {
      listItem.remove();
    }
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
   * - Attempts to create format instances for GEOJSON, WKT, KML, GPX, and GML using corresponding constructors.
   * - Continually builds a `formathelp` string that lists all formats successfully instantiated.
   * - Returns an object containing both the instantiated formats and the help string.
   *
   * Notes:
   * - Uses `wicket.js` to handle WKT data due to its parsing stability compared to OpenLayers for this format.
   * - Ensures debug logs are provided for tracing function execution when `debug` mode is active.
   **************************************************************/
  function createLayersFormats() {
    if (debug) console.log(`${scriptName}: createLayersFormats() called`);

    if (typeof Wkt === "undefined") {
      console.error(`${scriptName}: Wkt is not available. Ensure the library is correctly included via @require.`);
    }

    let formats = {};
    let formathelp = "";

    function tryCreateFormat(formatName, FormatConstructor) {
      try {
        formats[formatName] = new FormatConstructor();
        formathelp += `${formatName} | `;
      } catch (error) {
        console.error(`${formatName} format is not supported:`, error);
      }
    }
    tryCreateFormat("GEOJSON", OpenLayers.Format.GeoJSON);
    tryCreateFormat("WKT", Wkt.Wkt); //  use wicket.js to convert all WKT to geoJSON before parsefile() Wkt.read() Wkt.toJSON(), it is a better parser and more statble then OpenLayers.Format.WKT
    tryCreateFormat("KML", OpenLayers.Format.KML);
    tryCreateFormat("GPX", OpenLayers.Format.GPX);
    tryCreateFormat("GML", OpenLayers.Format.GML);
    return { formats, formathelp };
  }

  function addGroupToggler(isDefault, layerSwitcherGroupItemName, layerGroupVisibleName) {
    if (debug) console.log(`${scriptName}: addGroupToggler() called`);

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

    console.log(`${scriptName}: Group Toggler created for ${layerGroupVisibleName}`);
    return group;
  }

  function addLayerToggler(groupToggler, layerName, layerObj) {
    if (debug) console.log(`${scriptName}: addLayerToggler() called`);

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

  // Initialize your script
  if (W?.userscripts?.state.isInitialized) {
    init();
  } else {
    document.addEventListener("wme-initialized", init, { once: true });
  }
};
geometries();
