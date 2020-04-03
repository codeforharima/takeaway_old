/*	Make Walking_Town_Map Licence: MIT */
"use strict";

// Global Variable
var map;
var hash;
var Layer_Base;												// list base layers
var Layer_Data = {};												// Layer Status,geojson,svglayer
var Icons = {};												// アイコンSVG配列
var LL = {};												// 緯度(latitude)と経度(longitude)

const glot = new Glottologist();
const MinZoomLevel = 14;		// これ未満のズームレベルでは地図は作らない
const ZoomErrMsg = "地図を作るには、もう少しズームしてください。";
const NoSvgMsg = "保存するマップがありません。\nまず、左側の「以下の範囲でマップを作る」ボタンを押してください。";
const OvGetError = "サーバーからのデータ取得に失敗しました。やり直してください。";
const Mono_Filter = ['grayscale:90%', 'bright:85%', 'contrast:130%', 'sepia:15%'];;
const Download_Filename = 'Walking_Town_Map';
const OvServer = 'https://overpass.kumi.systems/api/interpreter'	// or 'https://overpass-api.de/api/interpreter' or 'https://overpass.nchc.org.tw/api/interpreter'
//const OvServer = 'https://overpass.nchc.org.tw/api/interpreter';
const OvServer_Org = 'https://overpass-api.de/api/interpreter';	// 本家(更新が早い)
const LeafContOpt = { collapsed: true };
const darken_param = 0.5;

const OverPass = {
	SIG: ['node["highway"="traffic_signals"]'],
	CFE: ['node["amenity"="cafe"]'],
	RST: ['node["amenity"="restaurant"]', 'node["shop"="deli"]'],
	FST: ['node["amenity"="fast_food"]', 'node["shop"="confectionery"]'],
	EXT: ['node["emergency"="fire_extinguisher"]'],
	HYD: ['node["emergency"="fire_hydrant"]'],
	BNC: ['node["amenity"="bench"]'],
	AED: ['node["emergency"="defibrillator"]'],
	LIB: ['node["amenity"="library"]', 'way["amenity"="library"]'],
};

const Defaults = {	// 制御情報の保管場所
	SIG: { init: true, zoom: 16, type: "node", name: "信号関連", icon: "./image/signal.svg", size: [18, 34] },
	CFE: { init: true, zoom: 16, type: "node", name: "カフェ等", icon: "./image/cafe.svg", size: [28, 28] },
	RST: { init: true, zoom: 16, type: "node", name: "飲食店等", icon: "./image/restaurant.svg", size: [28, 28] },
	FST: { init: true, zoom: 16, type: "node", name: "ファストフード", icon: "./image/fastfood.svg", size: [28, 28] },
	EXT: { init: true, zoom: 15, type: "node", name: "消火器", icon: "./image/fire_extinguisher.svg", size: [28, 28] },
	HYD: { init: true, zoom: 15, type: "node", name: "消火栓", icon: "./image/fire_hydrant.svg", size: [28, 28] },
	BNC: { init: true, zoom: 15, type: "node", name: "ベンチ", icon: "./image/bench.svg", size: [28, 28] },
	AED: { init: true, zoom: 15, type: "node", name: "AED", icon: "./image/aed.svg", size: [48, 48] },
	LIB: { init: true, zoom: 14, type: "node", name: "図書館", icon: "./image/library.svg", size: [28, 28] },
};

const LayerCounts = Object.keys(Defaults).length;
const MarkerParams = { icon_x: 18, icon_y: 18, text_size: 18, text_color: "black" };

// initialize leaflet
$(document).ready(function () {
	console.log("Welcome to Walking Town Map Maker.");
	console.log("initialize leaflet.");

	map = L.map('mapid', { center: [38.290, 138.988], zoom: 6 });
	map.zoomControl.setPosition("bottomright");
	//let L_Sel = L.control.layers(Layer_Base, null, LeafContOpt).addTo(map);
	hash = new L.Hash(map);
	let lc = L.control.locate({ position: 'bottomright', strings: { title: "現在地を表示" }, locateOptions: { maxZoom: 16 } }).addTo(map);

	console.log("initialize Basemenu.");
	L.control.scale({ imperial: false, maxWidth: 200 }).addTo(map);

	console.log("initialize frontend.");
	glot.import("./data/glot.json").then(() => { glot.render() });																// translation

	for (let key in Defaults) {
		Layer_Data[key] = {};
	};

	map.on('moveend', function (e) {
		LL.NW = map.getBounds().getNorthWest();
		LL.SE = map.getBounds().getSouthEast();
		switch (LL.busy) {
			case true:
				clearTimeout(LL.id);			// no break and cancel old timer.
			default:
				LL.busy = true;
				LL.id = setTimeout(() => {
					Takeaway.get();
					LL.busy = false;
				}, 1000);
		};
	});

	map.on('styleimagemissing', function (e) {
		var id = e.id;
		var prefix = 'square-rgb-';
		if (id.indexOf(prefix) !== 0) return;
		var rgb = id
			.replace(prefix, '')
			.split(',')
			.map(Number);
		var width = 1;
		var bytesPerPixel = 1;
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

	var gl = L.mapboxGL({
		container: 'map',
		attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">© MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap contributors</a>',
		accessToken: 'no-token',
		style: 'https://api.maptiler.com/maps/streets/style.json?key=Eq2IyrHsOEGFU1W1fvd7'
	}).addTo(map);

});

var Takeaway = (function () {

	var targets = [];

	function SetGeoJson(key, osmxml) {
		let geojson = osmtogeojson(osmxml, { flatProperties: true });
		geojson.features.forEach(function (val) { delete val.id; }); // delete Unnecessary osmid
		Layer_Data[key].geojson = geojson;
		Layer_Data[key].view = true;
	};

	return {
		get: function (keys) {		/* 情報（アイコンなど）を地図に追加 */
			console.log("Takeaway: get start...");
			if (keys == undefined) {
				targets = [];
				for (let key in Defaults) {
					targets.push(key);
				};
			}else{
				targets = keys;
			};
			let ZoomLevel = map.getZoom();					// マップ範囲を探す
			if (ZoomLevel < MinZoomLevel) { console.log("MinZoomLevel..."); return false; }
			let maparea = '(' + LL.SE.lat + ',' + LL.NW.lng + ',' + LL.NW.lat + ',' + LL.SE.lng + ');';
			ProgressBar.show(0);

			let jqXHRs = [];
			targets.forEach(key => {
				if (Defaults[key].init && Defaults[key].zoom <= ZoomLevel) {
					let query = "", Progress = 0;
					for (let ovpass in OverPass[key]) { query += OverPass[key][ovpass] + maparea; }
					let url = OvServer + '?data=[out:json][timeout:30];(' + query + ');out body;>;out skel qt;';
					console.log("GET: " + url);
					jqXHRs.push($.get(url, function () {
						ProgressBar.show(Math.ceil(((++Progress + 1) * 100) / LayerCounts));
					}));
				}
			});

			$.when.apply($, jqXHRs).done(function () {
				let i = 0,arg;
				targets.forEach(key => {
					if (Defaults[key].init && Defaults[key].zoom <= ZoomLevel) {
						if (arguments[0][1] == undefined) {
							arg = arguments[1];
						} else {
							arg = arguments[i][1];
						};
						if (arg !== "success") { alert(OvGetError); return };
						SetGeoJson(key, arguments[i++][0]);
					}
				});
				Takeaway.update();
				console.log("Make TownMap: end");
			}).fail(function (jqXHR, statusText, errorThrown) {
				console.log(statusText);
			});
		},

		control: function (mode) {
			location.replace(hash.formatHash(map));
			switch (mode) {
				case "show":
					for (let key in Defaults) {			// Show control if key is present
						$('#' + key).hide();
						if (Defaults[key].zoom <= map.getZoom()) $('#' + key).show();
					};
					$("#make_map").hide();
					$("#accordion").show();
					$("#custom_map").show();
					$("#save_map").show();
					$("#clear_map").show();
					break;
				case "hide":
					$("#make_map").show();
					$("#accordion").hide();
					$("#custom_map").hide();
					$("#save_map").hide();
					$("#clear_map").hide();
					break
			}
		},

		// Update Access Map(color/lime weight change)
		update: function (targetkey) {
			console.log("Takeaway: update... ");
			if (targetkey == "" || typeof (targetkey) == "undefined") {											// no targetkey then update all layer
				for (let key in Defaults) {
					if (Layer_Data[key].svg !== undefined) map.removeLayer(Layer_Data[key].svg);
					if (Layer_Data[key].view) MakeLayer(key);
				}
			} else {
				if (Layer_Data[targetkey].svg !== undefined) map.removeLayer(Layer_Data[targetkey].svg);
				if (Layer_Data[targetkey].view) MakeLayer(targetkey);
			}
			console.log("Takeaway: update... end ");
		}
	}
})();
