// ==UserScript==
// @name                WME Geometries
// @version             1.8
// @description         Import geometry files into Waze Map Editor. Supports GeoJSON, GML, WKT, KML and GPX.
// @match               https://www.waze.com/*/editor*
// @match               https://www.waze.com/editor*
// @match               https://beta.waze.com/*
// @exclude             https://www.waze.com/*user/*editor/*
// @require             https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.4.4/lz-string.min.js
// @grant               none
// @author              Timbones
// @contributor         wlodek76
// @contributor         Twister-UK
// @namespace           https://greasyfork.org/users/3339
// @run-at              document-idle
// ==/UserScript==
/*
 
    Blah Blah Blah
 
*/
 
/* JSHint Directives */
/* globals OpenLayers: true */
/* globals LZString: true */
/* globals W: true */
/* globals $: true */
/* globals I18n: true */
/* jshint bitwise: false */
/* jshint evil: true */
/* jshint esversion: 6 */
 
var geometries = function() {
  // maximum number of features that will be shown with labels
  var maxlabels = 2500;
 
  // show labels using first attribute that starts or ends with 'name' (case insensitive regexp)
  var labelname = /^name|name$/;
 
  // each loaded file will be rendered with one of these colours in ascending order
  var colorlist = ["deepskyblue", "magenta", "limegreen", "orange", "teal", "grey"];
 
  // -------------------------------------------------------------
  var geolist;
 
  var formats;
  var EPSG_4326; // lat,lon
  var EPSG_4269; // NAD 83
  var EPSG_3857; // WGS 84
 
  var layerindex = 0;
  var storedLayers = [];
 
  // delayed initialisation
  setTimeout(bootstrap, 1654);
 
  function layerStoreObj(fileContent, color, fileext, filename) {
    this.fileContent = fileContent;
    this.color = color;
    this.fileext = fileext;
    this.filename = filename;
  }
 
  function loadLayers() {
    // Parse any locally stored layer objects
    if (localStorage.WMEGeoLayers != undefined) {
      storedLayers = JSON.parse(LZString.decompress(localStorage.WMEGeoLayers));
      for (layerindex = 0; layerindex < storedLayers.length; ++layerindex) {
        parseFile(storedLayers[layerindex]);
      }
    } else {
      storedLayers = [];
    }
  }
 
  function bootstrap() {
    if (W.userscripts?.state.isReady) {
        init();
    } else {
        document.addEventListener("wme-ready", init, {
            once: true,
        });
    }
  }
 
  // add interface to Settings tab
  function init() {
    var formathelp = 'GeoJSON, WKT';
    formats = { 'GEOJSON':new OpenLayers.Format.GeoJSON(),
                'WKT':new OpenLayers.Format.WKT() };
    patchOpenLayers(); // patch adds KML, GPX and TXT formats
 
    EPSG_4326 = new OpenLayers.Projection("EPSG:4326"); // lat,lon
    EPSG_4269 = new OpenLayers.Projection("EPSG:4269"); // NAD 83
    EPSG_3857 = new OpenLayers.Projection("EPSG:3857"); // WGS 84
    var geobox = document.createElement('div');
    geobox.style.paddingTop = '6px';
 
    console.group("WME Geometries: Initialising for Editor");
    $("#sidepanel-areas").append(geobox);
 
    var geotitle = document.createElement('h4');
    geotitle.innerHTML = 'Import Geometry File';
    geobox.appendChild(geotitle);
 
    geolist = document.createElement('ul');
    geobox.appendChild(geolist);
 
    var geoform = document.createElement('form');
    geobox.appendChild(geoform);
 
    var inputfile = document.createElement('input');
    inputfile.type = 'file';
    inputfile.id = 'GeometryFile';
    inputfile.title = '.geojson, .gml or .wkt';
    inputfile.addEventListener('change', addGeometryLayer, false);
    geoform.appendChild(inputfile);
 
    var notes = document.createElement('p');
    notes.style.marginTop = "12px";
    notes.innerHTML = `<b>Formats:</b> <span id="formathelp">${formathelp}</span><br> `
                    + '<b>Coords:</b> EPSG:4326, EPSG:4269, EPSG:3857';
    geoform.appendChild(notes);
 
    var inputstate = document.createElement('input');
    inputstate.type = 'button';
    inputstate.value = 'Draw State Boundary';
    inputstate.title = 'Draw the boundary for the topmost state';
    inputstate.onclick = drawStateBoundary;
    geoform.appendChild(inputstate);
 
    var inputclear = document.createElement('input');
    inputclear.type = 'button';
    inputclear.value = 'Clear All';
    inputclear.style.marginLeft = '8px';
    inputclear.onclick = removeGeometryLayers;
    geoform.appendChild(inputclear);
 
    loadLayers();
 
    console.groupEnd("WME Geometries: initialised");
  }
 
  function addFormat(format) {
    $('#formathelp')[0].innerText += ", " + format;
  }
 
  function drawStateBoundary() {
    if (!W.model.topState || !W.model.topState.attributes || !W.model.topState.attributes.geometry) {
      console.info("WME Geometries: no state or geometry available, sorry");
      return;
    }
 
    var layerName = `(${W.model.topState.attributes.name})`;
    var layers = W.map.getLayersBy("layerGroup", "wme_geometry");
    for (var i = 0; i < layers.length; i++) {
      if (layers[i].name == "Geometry: " + layerName) {
        console.info("WME Geometries: current state already loaded");
        return;
      }
    }
 
    var geo = formats.GEOJSON.parseGeometry(W.model.topState.attributes.geometry);
    var json = formats.GEOJSON.write(geo);
    var obj = new layerStoreObj(json, "grey", "GEOJSON", layerName);
    parseFile(obj);
  }
 
  // import selected file as a vector layer
  function addGeometryLayer() {
    // get the selected file from user
    var fileList = document.getElementById('GeometryFile');
    var file = fileList.files[0];
    fileList.value = '';
 
    var fileext = file.name.split('.').pop();
    var filename = file.name.replace('.' + fileext, '');
    fileext = fileext.toUpperCase();
 
    // add list item
    var color = colorlist[(layerindex++) % colorlist.length];
    var fileitem = document.createElement('li');
    fileitem.id = file.name.toLowerCase();
    fileitem.style.color = color;
    fileitem.innerHTML = 'Loading...';
    geolist.appendChild(fileitem);
 
    // check if format is supported
    var parser = formats[fileext];
    if (typeof parser == 'undefined') {
      fileitem.innerHTML = fileext.toUpperCase() + ' format not supported :(';
      fileitem.style.color = 'red';
      return;
    }
 
    // read the file into the new layer, and update the localStorage layer cache
    var reader = new FileReader();
    reader.onload = (function(theFile) {
      return function(e) {
        var tObj = new layerStoreObj(e.target.result, color, fileext, filename);
        storedLayers.push(tObj);
        parseFile(tObj);
        localStorage.WMEGeoLayers = LZString.compress(JSON.stringify(storedLayers));
        console.info(`WME Geometries stored ${localStorage.WMEGeoLayers.length/1000} kB in localStorage`);
      };
    })(file);
 
    reader.readAsText(file);
  }
 
  // Renders a layer object
  function parseFile(layerObj) {
    var layerStyle = {
      strokeColor: layerObj.color,
      strokeOpacity: 0.75,
      strokeWidth: 3,
      fillColor: layerObj.color,
      fillOpacity: 0.1,
      pointRadius: 6,
      fontColor: 'white',
      labelOutlineColor: layerObj.color,
      labelOutlineWidth: 4,
      labelAlign: 'left'
    };
 
    var parser = formats[layerObj.fileext];
    parser.internalProjection = W.map.getProjectionObject();
    parser.externalProjection = EPSG_4326;
 
    // add a new layer for the geometry
    var layerid = 'wme_geometry_' + layerindex;
    var WME_Geometry = new OpenLayers.Layer.Vector(
      "Geometry: " + layerObj.filename, {
        rendererOptions: {
          zIndexing: true
        },
        uniqueName: layerid,
        shortcutKey: "S+" + layerindex,
        layerGroup: 'wme_geometry'
      }
    );
 
    WME_Geometry.setZIndex(-9999);
    WME_Geometry.displayInLayerSwitcher = true;
 
    // hack in translation:
    I18n.translations[I18n.locale].layers.name[layerid] = "WME Geometries: " + layerObj.filename;
 
    if (/"EPSG:3857"|:EPSG::3857"/.test(layerObj.fileContent)) {
      parser.externalProjection = EPSG_3857;
    }
    else if (/"EPSG:4269"|:EPSG::4269"/.test(layerObj.fileContent)) {
      parser.externalProjection = EPSG_4269;
    }
    // else default to EPSG:4326
 
    // load geometry files
    var features = parser.read(layerObj.fileContent);
 
    // check we have features to render
    if (features.length > 0) {
      // check which attribute can be used for labels
      var labelwith = '(no labels)';
      if (features.length <= maxlabels) {
        for (var attrib in features[0].attributes) {
          if (labelname.test(attrib.toLowerCase()) === true) {
            if (typeof features[0].attributes[attrib] == 'string') {
              labelwith = 'Labels: ' + attrib;
              layerStyle.label = '${' + attrib + '}';
              break;
            }
          }
        }
      }
      WME_Geometry.styleMap = new OpenLayers.StyleMap(layerStyle);
 
      // add data to the map
      WME_Geometry.addFeatures(features);
      W.map.addLayer(WME_Geometry);
    }
 
    // When called as part of loading a new file, the list object will already have been created,
    // whereas if called as part of reloding cached data we need to create it here...
    var liObj = document.getElementById((layerObj.filename + '.' + layerObj.fileext).toLowerCase());
    if (liObj === null) {
      liObj = document.createElement('li');
      liObj.id = (layerObj.filename + '.' + layerObj.fileext).toLowerCase();
      liObj.style.color = layerObj.color;
      geolist.appendChild(liObj);
    }
 
    if (features.length === 0) {
      liObj.innerHTML = 'No features loaded :(';
      liObj.style.color = 'red';
      WME_Geometry.destroy();
    } else {
      liObj.innerHTML = layerObj.filename;
      liObj.title = layerObj.fileext.toUpperCase() + " " + parser.externalProjection.projCode +
        ": " + features.length + " features loaded\n" + labelwith;
 
      console.info("WME Geometries: Loaded " + liObj.title);
    }
  }
 
  // clear all
  function removeGeometryLayers() {
    var layers = W.map.getLayersBy("layerGroup", "wme_geometry");
    for (var i = 0; i < layers.length; i++) {
      layers[i].destroy();
    }
    geolist.innerHTML = '';
    layerindex = 0;
    // Clear the cached layers
    localStorage.removeItem('WMEGeoLayers');
    storedLayers = [];
    return false;
  }
 
  // ------------------------------------------------------------------------------------
 
  // replace missing functions in OpenLayers 2.13.1
  function patchOpenLayers() {
    console.group("WME Geometries: Patching missing features...");
    if (!OpenLayers.VERSION_NUMBER.match(/^Release [0-9.]*$/)) {
      console.error("WME Geometries: OpenLayers version mismatch (" + OpenLayers.VERSION_NUMBER + ") - cannot apply patch");
      return;
    }
 
    loadOLScript("lib/OpenLayers/Format/KML", function() {formats.KML = new OpenLayers.Format.KML(); addFormat("KML");} );
    loadOLScript("lib/OpenLayers/Format/GPX", function() {formats.GPX = new OpenLayers.Format.GPX(); addFormat("GPX");} );
    loadOLScript("lib/OpenLayers/Format/GML", function() {formats.GML = new OpenLayers.Format.GML(); addFormat("GML");} );
    console.groupEnd();
  }
};
// ------------------------------------------------------------------------------------
 
// https://cdnjs.com/libraries/openlayers/x.y.z/
function loadOLScript(filename, callback) {
  var version = OpenLayers.VERSION_NUMBER.replace(/Release /, '');
  console.info("Loading openlayers/" + version + "/" + filename + ".js");
 
  var openlayers = document.createElement('script');
  openlayers.src = "https://cdnjs.cloudflare.com/ajax/libs/openlayers/" + version + "/" + filename + ".js";
  openlayers.type = "text/javascript";
  openlayers.onload = callback;
  document.head.appendChild(openlayers);
}
 
geometries();
 
// ----------------------------------------------------------------------------
