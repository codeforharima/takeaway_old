/*	Make Walking_Town_Map Licence: MIT */
"use strict";

// Global Variable
var map;
var hash;
var Layer_Base;												// list base layers
var Layer_Data;												// Layer Status,geojson,svglayer
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

const Sakura1 = "Cherry blossom";
const Sakura2 = "Cerasus itosakura";
const Sakura3 = "Cerasus × yedoensis";
const ExtDatas = { SHL: "./data/mapnavoskdat_hinanbiru.geojson" };

const OverPass = {
	PRK: ['relation["leisure"="park"]', 'way["leisure"="playground"]', 'way["leisure"="park"]', 'way["leisure"="pitch"]'],
	PED: ['way["highway"="pedestrian"]["area"]'],
	PKG: ['way["amenity"="parking"]', 'way["amenity"="bicycle_parking"]'],
	GDN: ['way["leisure"="garden"]', 'way["landuse"="grass"]'],
	RIV: ['relation["waterway"]', 'way["waterway"]', 'way["landuse"="reservoir"]', 'relation["natural"="water"]', 'way["natural"="water"]', 'way["natural"="coastline"]["place"!="island"]'],
	FRT: ['relation["landuse"="forest"]', 'relation["natural"="wood"]', 'way["landuse"="forest"]', 'way["natural"="wood"]', 'way["natural"="scrub"]', 'way["landuse"="farmland"]', 'way["landuse"="allotments"]'],
	RIL: ['way["railway"]'],
	ALY: ['way["highway"="footway"]', 'way["highway"="path"]', 'way["highway"="track"]', 'way["highway"="steps"]'],
	STD: ['way["highway"~"tertiary"]','way["highway"~"unclassified"]', 'way["highway"~"residential"]', 'way["highway"="living_street"]', 'way["highway"="pedestrian"][!"area"]', 'way["highway"="service"]'],
	PRI: ['way["highway"~"trunk"]','way["highway"~"primary"]', 'way["highway"~"secondary"]'],
	HIW: ['way["highway"~"motorway"]'],
	BLD: ['way["building"!="train_station"]["building"]', 'relation["building"!="train_station"]["building"]'],
	BRR: ['way["barrier"]["barrier"!="kerb"]["barrier"!="ditch"]'],
	STN: ['relation["building"="train_station"]', 'way["building"="train_station"]'],
	SIG: ['node["highway"="traffic_signals"]'],
	CFE: ['node["amenity"="cafe"]'],
	RST: ['node["amenity"="restaurant"]', 'node["shop"="deli"]'],
	FST: ['node["amenity"="fast_food"]', 'node["shop"="confectionery"]'],
	EXT: ['node["emergency"="fire_extinguisher"]'],
	HYD: ['node["emergency"="fire_hydrant"]'],
	BNC: ['node["amenity"="bench"]'],
	AED: ['node["emergency"="defibrillator"]'],
	LIB: ['node["amenity"="library"]', 'way["amenity"="library"]'],
	SKR: ['node["species"="' + Sakura1 + '"]', 'node["species:en"="' + Sakura1 + '"]', 'node["species"="' + Sakura2 + '"]', 'node["species:en"="' + Sakura2 + '"]', 'node["species"="' + Sakura3 + '"]', 'node["species:en"="' + Sakura3 + '"]']
};

const Defaults = {	// 制御情報の保管場所
	PRK: { init: true, zoom: 15, type: "area", name: "各種公園", color: "#e8ffd0", width: 0.3, dashArray: null },
	PED: { init: true, zoom: 15, type: "area", name: "各種広場", color: "#ffffe8", width: 0.3, dashArray: null },
	PKG: { init: true, zoom: 15, type: "area", name: "駐車場", color: "#f0f0f0", width: 0.3, dashArray: null },
	GDN: { init: true, zoom: 16, type: "area", name: "庭・草原", color: "#d8ffb8", width: 0.3, dashArray: null },
	RIV: { init: true, zoom: 15, type: "area", name: "水路・川", color: "#b0d0f8", width: 0.3, dashArray: null },
	FRT: { init: true, zoom: 15, type: "area", name: "森・田畑", color: "#b0f090", width: 0.3, dashArray: null },
	RIL: { init: true, zoom: 13, type: "line", name: "レール類", color: "#909090", width: 1.2, dashArray: "12,6" },
	ALY: { init: true, zoom: 16, type: "line", name: "路地小道", color: "#e8e8e8", width: 0.8, dashArray: "4,3" },
	STD: { init: true, zoom: 14, type: "line", name: "一般道路", color: "#ffffe8", width: 4.0, dashArray: null },
	PRI: { init: true, zoom: 13, type: "line", name: "主要道路", color: "#ffe8d0", width: 4.5, dashArray: null },
	HIW: { init: true, zoom: 13, type: "line", name: "高速道路", color: "#f8d0a0", width: 5.0, dashArray: null },
	BLD: { init: true, zoom: 16, type: "area", name: "建物・家", color: "#e8e8e8", width: 0.5, dashArray: null },
	BRR: { init: true, zoom: 16, type: "line", name: "壁・擁壁", color: "#b0b0b0", width: 0.6, dashArray: null },
	STN: { init: true, zoom: 15, type: "area", name: "駅施設等", color: "#f8d8d8", width: 0.5, dashArray: null },
	SIG: { init: false, zoom: 16, type: "node", name: "信号関連", icon: "./image/signal.svg", size: [18, 34] },
	CFE: { init: false, zoom: 16, type: "node", name: "カフェ等", icon: "./image/cafe.svg", size: [28, 28] },
	RST: { init: false, zoom: 16, type: "node", name: "飲食店等", icon: "./image/restaurant.svg", size: [28, 28] },
	FST: { init: false, zoom: 16, type: "node", name: "ファストフード", icon: "./image/fastfood.svg", size: [28, 28] },
	EXT: { init: false, zoom: 15, type: "node", name: "消火器", icon: "./image/fire_extinguisher.svg", size: [28, 28] },
	HYD: { init: false, zoom: 15, type: "node", name: "消火栓", icon: "./image/fire_hydrant.svg", size: [28, 28] },
	BNC: { init: false, zoom: 15, type: "node", name: "ベンチ", icon: "./image/bench.svg", size: [28, 28] },
	AED: { init: false, zoom: 15, type: "node", name: "AED", icon: "./image/aed.svg", size: [48, 48] },
	LIB: { init: false, zoom: 14, type: "node", name: "図書館", icon: "./image/library.svg", size: [28, 28] },
	SKR: { init: false, zoom: 15, type: "node", name: "木（さくら）", icon: "./image/sakura.svg", size: [28, 28] },
	SHL: { init: false, zoom: 14, type: "node", name: "避難所(大阪市)", icon: "./image/shelter.svg", size: [28, 28] }
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
	var gl = L.mapboxGL({
		container: 'map',
		attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">© MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap contributors</a>',
		accessToken: 'no-token',
		style: 'https://api.maptiler.com/maps/streets/style.json?key=Eq2IyrHsOEGFU1W1fvd7'
	}).addTo(map);

	console.log("initialize Basemenu.");
	L.control.scale({ imperial: false, maxWidth: 200 }).addTo(map);

	console.log("initialize frontend.");
	glot.import("./data/glot.json").then(() => { glot.render() });																// translation
});

var TownMap = (function () {

	function MakeCancel() {
		$("#MakeCancel_Modal").modal({ backdrop: "static", keyboard: false });
	};
	function SetGeoJson(key, osmxml) {
		let geojson = osmtogeojson(osmxml, { flatProperties: true });
		geojson.features.forEach(function (val) { delete val.id; }); // delete Unnecessary osmid
		Layer_Data[key].geojson = geojson;
		Layer_Data[key].view = true;														// view when there is a target
	};

	return {
		make: function (query_date) {
			console.log("Make TownMap: Start");
			let ZoomLevel = map.getZoom();					// マップ範囲を探す
			if (ZoomLevel < MinZoomLevel) { MakeCancel(); return false; }
			if (typeof (query_date) == "undefined") query_date = "";
			LL.NW = map.getBounds().getNorthWest();
			LL.SE = map.getBounds().getSouthEast();
			let maparea = '(' + LL.SE.lat + ',' + LL.NW.lng + ',' + LL.NW.lat + ',' + LL.SE.lng + ');';
			let Progress = 0;
			ProgressBar.show(0);

			let jqXHRs = [];
			for (let key in Defaults) {
				if (Defaults[key].init && Defaults[key].zoom <= ZoomLevel) {
					let query = "";
					for (let ovpass in OverPass[key]) { query += OverPass[key][ovpass] + maparea; }
					let url = OvServer + '?data=[out:json][timeout:30]' + query_date + ';(' + query + ');out body;>;out skel qt;';
					console.log("GET: " + url);
					jqXHRs.push($.get(url, function () {
						ProgressBar.show(Math.ceil(((++Progress + 1) * 100) / LayerCounts));
					}));
				}
			};
			$.when.apply($, jqXHRs).done(function () {
				let i = 0;
				for (let key in Defaults) {
					if (Defaults[key].init && Defaults[key].zoom <= ZoomLevel) {
						if (arguments[i][1] !== "success") { alert(OvGetError); return };
						SetGeoJson(key, arguments[i++][0]);
					}
				}
				TownMap.update();
				ProgressBar.hide();
				TownMap.control('show');
				console.log("Make TownMap: end");
			});
		},
		/* 情報（アイコンなど）を地図に追加 */
		add: function (key) {
			console.log("TownMap: add start..." + key);
			let ZoomLevel = map.getZoom();					// マップ範囲を探す
			if (ZoomLevel < MinZoomLevel) { MakeCancel(); return false; }
			LL.NW = map.getBounds().getNorthWest();
			LL.SE = map.getBounds().getSouthEast();
			let maparea = '(' + LL.SE.lat + ',' + LL.NW.lng + ',' + LL.NW.lat + ',' + LL.SE.lng + ');';
			ProgressBar.show(0);

			switch (OverPass[key]) {
				case undefined:
					console.log(ExtDatas[key]);
					$.get({ url: ExtDatas[key], dataType: "json" }, function (geojson) {
						let maped_geojson = geojson.features.filter(function (value) {
							let geoll = value.geometry.coordinates;
							if (geoll[0] > LL.NW.lng && geoll[0] < LL.SE.lng && geoll[1] < LL.NW.lat && geoll[1] > LL.SE.lat) return true;
						});
						if (maped_geojson.length > 0) {
							geojson.features = maped_geojson;
							Layer_Data[key].geojson = geojson;
							Layer_Data[key].view = true;														// view when there is a target
							TownMap.update(key);
						}
						ProgressBar.hide();
						TownMap.control('show');
						console.log("Add TownMap: end");
					});
					break;

				default: 																								//use overpass
					let jqXHRs = [], query = "", Progress = 0;
					for (let ovpass in OverPass[key]) { query += OverPass[key][ovpass] + maparea; }
					jqXHRs.push($.get(OvServer + '?data=[out:json][timeout:30];(' + query + ');out body;>;out skel qt;', function (data) {
						ProgressBar.show(Math.ceil(((++Progress + 1) * 100) / LayerCounts));
					}));
					$.when.apply($, jqXHRs).done(function () {
						if (arguments[1] == "success") {
							SetGeoJson(key, arguments[0]);
							TownMap.update(key);
						};
						ProgressBar.hide();
						TownMap.control('show');
						console.log("Add TownMap: end");
					}).fail(function (jqXHR, statusText, errorThrown) {
						console.log(statusText);
					});
					break;
			}
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
			console.log("TownMap: update... ");
			if (targetkey == "" || typeof (targetkey) == "undefined") {											// no targetkey then update all layer
				for (let key in Defaults) {
					if (Layer_Data[key].svg) map.removeLayer(Layer_Data[key].svg);
					if (Layer_Data[key].view) MakeLayer(key);
				}
			} else {
				if (Layer_Data[targetkey].svg) map.removeLayer(Layer_Data[targetkey].svg);
				if (Layer_Data[targetkey].view) MakeLayer(targetkey);
			}
			console.log("TownMap: update... end ");

		}
	}
})();

