// Takeout MAP with everyone Licence: MIT
"use strict";

// Global Variable
var map,gl,hash;			// map,gl,hash
var Layer_Data = {};		// {key: {geojson,marker}}
var LL = {};				// latlng
var Categorys;

const glot = new Glottologist();
const MinZoomLevel = 14;	// これ未満のズームレベルでは地図は作らない
const OvGetError = "サーバーからのデータ取得に失敗しました。やり直してください。";
const OvServer = 'https://overpass.kumi.systems/api/interpreter'	// or 'https://overpass-api.de/api/interpreter' or 'https://overpass.nchc.org.tw/api/interpreter'
//const OvServer = 'https://overpass.nchc.org.tw/api/interpreter';
const OvServer_Org = 'https://overpass-api.de/api/interpreter';	// 本家(更新が早い)

const OverPass = {
	TAK: ['node["takeaway"!="no"]["takeaway"]', 'way["takeaway" != "no"]["takeaway"]'],
	DEL: ['node["delivery"!="no"]["delivery"]', 'way["delivery"!="no"]["delivery"]'],
	VND: ['node["amenity"="vending_machine"]["vending"="drinks"]'],
	LIB: ['node["amenity"="library"]', 'way["amenity"="library"]'],
};
const Defaults = {	// 制御情報の保管場所
	TAK: { init: true, zoom: 14, icon: "./image/bentou.svg", size: [28, 28] },
	DEL: { init: true, zoom: 14, icon: "./image/bentou.svg", size: [28, 28] },
	VND: { init: true, zoom: 16, icon: "./image/vending.svg", size: [28, 28] },
	LIB: { init: true, zoom: 12, icon: "./image/library.svg", size: [28, 28] },
};
const DataList_Targets = ["TAK", "DEL", "LIB"]; 
const LayerCounts = Object.keys(Defaults).length;

// first initialize
for (let key in Defaults) Layer_Data[key] = {};

let jqXHRs = [];
const FILES = ['modals.html','data/category-ja.json'];
for (let key in FILES) { jqXHRs.push($.get(FILES[key])) };
$.when.apply($, jqXHRs).always(function () {
	$("#Modals").html(arguments[0][0]);
	Categorys = arguments[1][0];
});

$(document).ready(function () {
	// initialize leaflet
	console.log("Welcome to Takeaway.");
	console.log("initialize leaflet.");
	map = L.map('mapid', { center: [38.290, 138.988], zoom: 6, maxZoom: 20 });
	gl = L.mapboxGL({
		container: 'map',
		attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">© MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap contributors</a>',
		accessToken: 'no-token',
		style: 'https://api.maptiler.com/maps/3c10e59f-b7de-4ca9-b95b-75e30257f090/style.json?key=Eq2IyrHsOEGFU1W1fvd7'
	}).addTo(map);
	map.zoomControl.setPosition("bottomright");
	hash = new L.Hash(map);
	let lc = L.control.locate({ position: 'bottomright', strings: { title: "現在地を表示" }, locateOptions: { maxZoom: 16 } }).addTo(map);
	L.control.scale({ imperial: false, maxWidth: 200 }).addTo(map);

	map.on('moveend', function (e) {
		LL.NW = map.getBounds().getNorthWest();
		LL.SE = map.getBounds().getSouthEast();
		switch (LL.busy) {
			case true:
				clearTimeout(LL.id);			// no break and cancel old timer.
			default:
				LL.busy = true;
				LL.id = setTimeout(() => {
					Takeaway.get("", () => DataList.view(DataList_Targets));
					LL.busy = false;
				}, 1000);
		};
	});

	map.on('styleimagemissing', function (e) {
		var id = e.id,prefix = 'square-rgb-';
		if (id.indexOf(prefix) !== 0) return;
		var rgb = id.replace(prefix, '').split(',').map(Number);
		var width = 1,bytesPerPixel = 1;
		var data = new Uint8Array(width * width * bytesPerPixel);
		for (var x = 0; x < width; x++) {
			for (var y = 0; y < width; y++) {
				var offset = (y * width + x) * bytesPerPixel;
				data[offset + 0] = rgb[0]; // red
				data[offset + 1] = rgb[1]; // green
				data[offset + 2] = rgb[2]; // blue
				data[offset + 3] = 0; // alpha
			}
		}
		map.addImage(id, { width: width, height: width, data: data });
	});

	// etc
	glot.import("./data/glot.json").then(() => { glot.render() });																// translation

});
