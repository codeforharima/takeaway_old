// Takeout MAP with everyone Licence: MIT
"use strict";

// Global Variable
var map, gl, hash, timeout = 0;	// map,gl,hash,search timeout
var Layer_Data = {};			// {key: {geojson,marker}}
var LL = {};					// latlng
var Categorys,DatatablesLang;
var glot;

// consts
const MinZoomLevel = 14;	// これ未満のズームレベルでは地図は作らない
const MoreZoomMsg = "ズームすると店舗が表示されます。";
const OvGetError = "サーバーからのデータ取得に失敗しました。やり直してください。";
const OvServer = 'https://overpass.kumi.systems/api/interpreter'	// or 'https://overpass-api.de/api/interpreter' or 'https://overpass.nchc.org.tw/api/interpreter'
//const OvServer = 'https://overpass.nchc.org.tw/api/interpreter';
const OvServer_Org = 'https://overpass-api.de/api/interpreter';	// 本家(更新が早い)
const RegexPTN = [[/Mo/g, "月"], [/Tu/g, "火"], [/We/g, "水"], [/Th/g, "木"], [/Fr/g, "金"], [/Sa/g, "土"], [/Su/g, "日"], [/;/g, "<br>"], [/PH/g, "祝日"], [/off/g, "休業"], [/24\/7/g, "24時間営業"]];
const FILES = ['modals.html', 'data/category-ja.json','data/datatables-ja.json'];

const OverPass = {
	TAK: ['node["takeaway"!="no"]["takeaway"]', 'way["takeaway" != "no"]["takeaway"]'],
	DEL: ['node["delivery"!="no"]["delivery"]', 'way["delivery"!="no"]["delivery"]'],
	VND: ['node["amenity"="vending_machine"]["vending"="drinks"]'],
	LIB: ['node["amenity"="library"]', 'way["amenity"="library"]'],
};
const Defaults = {	// 制御情報の保管場所
	TAK: { init: true, zoom: 14, icon: "./image/bentou.svg" },
	DEL: { init: true, zoom: 14, icon: "./image/bentou.svg" },
	VND: { init: true, zoom: 17, icon: "./image/vending.svg" },
	LIB: { init: true, zoom: 14, icon: "./image/library.svg" },
};
const DataList_Targets = ["TAK", "DEL", "LIB"];

// Welcome Message
console.log("Welcome to Takeaway.");

let jqXHRs = [];	// file load
for (let key in FILES) { jqXHRs.push($.get(FILES[key])) };
$.when.apply($, jqXHRs).always(function () {
	$("#Modals").html(arguments[0][0]);
	Categorys = arguments[1][0];
	DatatablesLang = arguments[2][0];
});

$(document).ready(function () {
	// Set Window Size
	console.log("Window Width: " + window.innerWidth);
	let use_H, magni = window.innerWidth < 768 ? 0.7 : 1;
	switch (magni) {
		case 1:		// 横画面
			use_H = window.innerHeight - 40;
			$("#mapid").css("height", Math.round(use_H * magni) + "px");
			$("#dataid").css("height", (window.innerHeight - 84) + "px");
			break;

		default:	// 縦画面
			use_H = window.innerHeight - 84;
			let map_H = Math.round(use_H * magni);
			let dat_H = use_H - map_H;
			$("#mapid").css("height", map_H + "px");
			$("#dataid").css("height", dat_H + "px");
			break;
	}

	// initialize variable
	glot = new Glottologist();
	for (let key in Defaults) Layer_Data[key] = {};

	// initialize leaflet
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
	L.control.locate({ position: 'bottomright', strings: { title: "現在地を表示" }, locateOptions: { maxZoom: 16 } }).addTo(map);
	L.control.scale({ imperial: false, maxWidth: 200 }).addTo(map);

	// マップ移動時の処理
	map.on('moveend', function (e) {
		console.log("moveend: event start.");
		LL.NW = map.getBounds().getNorthWest();
		LL.SE = map.getBounds().getSouthEast();
		switch (LL.busy) {
			case true:
				clearTimeout(LL.id);			// no break and cancel old timer.
			default:
				LL.busy = true;
				LL.id = setTimeout(() => {
					Takeaway.get("", () => {
						DataList.lock(true);
						DataList.view(DataList_Targets);
						DataList.lock(false);
					});
					LL.busy = false;
				}, 1000);
		};
	});

	// ズーム時のメッセージ表示
	map.on('zoomend', function (e) {
		if (map.getZoom() < MinZoomLevel) {
			DisplayStatus.morezoom(MoreZoomMsg);
		} else {
			DisplayStatus.morezoom("");
		}
	});

	// スタイル不足時のエラー回避
	map.on('styleimagemissing', function (e) {
		var id = e.id, prefix = 'square-rgb-';
		if (id.indexOf(prefix) !== 0) return;
		var rgb = id.replace(prefix, '').split(',').map(Number);
		var width = 1, bytesPerPixel = 1;
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

	let keyword = document.getElementById("keyword");
	keyword.addEventListener("input", (e) => {
		if (timeout > 0) {
			window.clearTimeout(timeout);
			timeout = 0;
		};
		timeout = window.setTimeout(() => DataList.filter(e.target.value), 500);
	});

	window.onresize = window_resize;
});

function window_resize() {
	let use_H, magni = window.innerWidth < 768 ? 0.7 : 1;
	switch (magni) {
		case 1:		// 横画面
			use_H = window.innerHeight - 40;
			$("#mapid").css("height", Math.round(use_H * magni) + "px");
			$("#dataid").css("height", (window.innerHeight - 84) + "px");
			break;

		default:	// 縦画面
			use_H = window.innerHeight - 84;
			let map_H = Math.round(use_H * magni);
			let dat_H = use_H - map_H;
			$("#mapid").css("height", map_H + "px");
			$("#dataid").css("height", dat_H + "px");
			break;
	};
}