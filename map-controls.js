/*	まち歩きマップメーカー Licence: MIT */
"use strict";

// make Layer
// MakeData内 -> name:コントロール名 / color:SVG色 / width:SVG Line Weight / dashArray:破線
function MakeLayer(key) {
	let data = Defaults[key];
	console.log("MakeLayer start");
	switch (data.type) {
		case "line":
		case "area":
			if (Layer_Data[key].svg !== undefined) { Layer_Data[key].svg.remove(map) }	// Delete an existing layer
			let param = {
				style: function (feature) {
					let common = {
						stroke: true, dashArray: data.dashArray, bubblingMouseEvents: false,
						lineJoin: 'round', bubblingMouseEvents: false, fillOpacity: 1.0
					};
					if (data.type == "area") {
						return Object.assign(common, {
							weight: Layer_Data[key].width * ((map.getZoom() - MinZoomLevel) * 0.8),
							color: Layer_Data[key].color_dark, fillColor: Layer_Data[key].color
						});
					} else {
						return Object.assign(common, {
							weight: Layer_Data[key].width * ((map.getZoom() - MinZoomLevel) * 0.8),
							color: Layer_Data[key].color, fillColor: Layer_Data[key].color_dark
						});
					}
				},
				filter: function (feature, layer) {
					if (feature.properties) { return feature.properties.underConstruction !== undefined ? !feature.properties.underConstruction : true; }
					return false;
				}
			};
			let svglayer = L.geoJSON(Layer_Data[key].geojson, param);					// geojsonからSVGレイヤーを作成
			svglayer.addTo(map);
			Layer_Data[key].svg = svglayer;
			break;

		case "node":
			let markers = [];
			if (Layer_Data[key].svg !== undefined) {
				Layer_Data[key].svg.forEach(function (marker) { marker.remove(map) });
			}	// Delete an existing layer

			Layer_Data[key].geojson.features.forEach(function (node) {
				let tagname = node.properties.name == undefined ? "" : node.properties.name;
				let icon = L.divIcon({
					className: 'icon',
					html: '<img class="icon" src="' + data.icon + '" icon-name="' + tagname + '"><span class="icon">' + tagname + '</span>',
					popupAnchor: [0, -10]
				});
				if (node.geometry.type == "Polygon") {
					markers.push(L.marker(new L.LatLng(node.geometry.coordinates[0][0][1], node.geometry.coordinates[0][0][0]), { icon: icon, draggable: true }));
				} else {
					markers.push(L.marker(new L.LatLng(node.geometry.coordinates[1], node.geometry.coordinates[0]), { icon: icon, draggable: true }));
				}
				let del_btn = "<input type='button' value='アイコンを削除' onclick='DeleteMarker(\"" + key + "\"," + (markers.length - 1) + ")'></input>";
				let chg_btn = "<input type='button' value='英語名に変更' onclick='ChgLngMarker(\"" + key + "\"," + (markers.length - 1) + ",\"name:en\")'></input>";
				let popcont = (tagname == '' ? '（名称不明）' : tagname) + "<br>" + del_btn + "<br>" + chg_btn;
				markers[markers.length - 1].addTo(map).bindPopup(popcont);
			});
			Layer_Data[key].svg = markers;
			$('#' + key + "_layer").prop('checked', true);
			break;

		default:
			console.log("MakeLayer: error -> " + data.type);
			break;
	}
}

function DeleteMarker(keyname, keyno) {
	map.removeLayer(Layer_Data[keyname].svg[keyno]);
}

function ChgLngMarker(keyname, keyno, name_tag) {
	map.removeLayer(Layer_Data[keyname].svg[keyno]);	// 一旦削除
	let features = Layer_Data[keyname].geojson.features[keyno];
	let tagname = features.properties.tags[name_tag];
	tagname = tagname == undefined ? "" : tagname;
	let icon = L.divIcon({
		className: 'icon',
		html: '<img class="icon" src="' + Defaults[keyname].icon + '" icon-name="' + tagname + '"><span class="icon">' + tagname + '</span>',
		popupAnchor: [0, -10]
	});
	let marker = L.marker(new L.LatLng(features.geometry.coordinates[1], features.geometry.coordinates[0]), { icon: icon, draggable: true });
	let del_btn = "<input type='button' value='アイコンを削除' onclick='DeleteMarker(\"" + keyname + "\"," + keyno + ")'></input>";
	let chg_btn1 = "<input type='button' value='日本語名に変更' onclick='ChgLngMarker(\"" + keyname + "\"," + keyno + ",\"name\")'></input>";
	let chg_btn2 = "<input type='button' value='英語名に変更' onclick='ChgLngMarker(\"" + keyname + "\"," + keyno + ",\"name:en\")'></input>";
	let popcont = (tagname == '' ? '（名称不明）' : tagname) + "<br>" + del_btn + "<br>" + (name_tag == "name" ? chg_btn2 : chg_btn1);
	marker.addTo(map).bindPopup(popcont);
	Layer_Data[keyname].svg[keyno] = marker;
}


/* Library & Subroutine */

// Progress Bar
var ProgressBar = (function () {
	return {
		show: function (percent) {
			$('#Progress_Bar').css('width', parseInt(percent) + "%");
			$('#Progress_Modal').modal({ backdrop: "static", keyboard: false });
		},
		hide: function () {
			$('#Progress_Bar').css('width', "0%");
			$('#Progress_Modal').modal("hide");
		}
	}
})();

// WriteText
//params .svg:svg .text:text .size:font size  .color:color .background:background color
function SVG_WriteText(params) {
	let svgtext = document.createElementNS('http://www.w3.org/2000/svg', 'text');
	svgtext.setAttributeNS(null, 'x', params.x);
	svgtext.setAttributeNS(null, 'y', params.y + 6);
	svgtext.setAttributeNS(null, 'text-anchor', params.anchor);
	svgtext.setAttributeNS(null, 'font-size', params.size + "px");
	svgtext.setAttributeNS(null, 'font-family', params.font);
	svgtext.setAttributeNS(null, 'fill', params.color);
	svgtext.setAttributeNS(null, 'name', 'tempsvg');
	svgtext.setAttributeNS(null, 'dominant-baseline', 'text-after-edge');
	svgtext.textContent = params.text;
	params.svg[0].appendChild(svgtext);

	let SVGRect = svgtext.getBBox();
	let rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
	rect.setAttribute("x", SVGRect.x);
	rect.setAttribute("y", SVGRect.y);
	rect.setAttribute("width", SVGRect.width);
	rect.setAttribute("height", SVGRect.height);
	rect.setAttribute("fill", "white");
	rect.setAttribute("fill-opacity", 0.9);
	rect.setAttributeNS(null, 'name', 'tempsvg');
	params.svg[0].insertBefore(rect, svgtext);
}

$.fn.extend({
	// MakerをSVGに追加
	// 理由：leafletがアイコンをIMG扱いするため
	AddIcons: function (marker) {
		var svg = this.filter('svg') || this.find('svg');
		let parser = new DOMParser();
		let svgDoc, svgvbox;
		for (let i = 0; i < marker.length; i++) {
			let marker_src = $(marker.eq(i)[0].children).attr('src');
			if (marker_src !== undefined) {
				let matched = MMK_Loads.filter(function (obj) {
					return obj.file.match(marker_src);
				});
				if (matched != "") {
					svgDoc = parser.parseFromString(Icons[matched[0].icon], "text/xml");
					let svgicon = $(svgDoc).children();
					if ($(svgicon).attr('viewBox') == undefined) {
						svgvbox = $(svgicon)[0].attr('viewBox').split(' ');
					} else {
						svgvbox = $(svgicon).attr('viewBox').split(' ');
					};
					let scale = Math.ceil((MarkerParams.icon_x / (svgvbox[2] - svgvbox[0])) * 1000) / 1000;
					let group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
					for (let key in svgicon[0].childNodes) {
						let nodeName = svgicon[0].childNodes[key].nodeName;
						if (nodeName == "path" || nodeName == "g" || nodeName == "defs" || nodeName == "rect" || nodeName == "ellipse" || nodeName == "style") {
							group.append(svgicon[0].childNodes[key].cloneNode(true));
						}
					}
					let svgstl = marker.eq(i).css("transform").slice(7, -1).split(",")	// transformのstyleから配列でXとY座標を取得(4と5)
					$(group).attr("transform", "matrix(1,0,0,1," + (Number(svgstl[4]) - MarkerParams.icon_x) + "," + (Number(svgstl[5]) - MarkerParams.icon_y) + ") scale(" + scale + ")");
					$(group).attr("name", "tempsvg");
					svg.append(group);
				}
			}
		}
		return;
	}
});

// DataURIからBlobへ変換（ファイルサイズ2MB超過対応）
function dataURItoBlob(dataURI) {
	const b64 = atob(dataURI.split(',')[1]);
	//	const u8 = Uint8Array.from(b64.split(""), e => e.charCodeAt());
	const u8 = Uint8Array.from(b64.split(""), function (e) { return e.charCodeAt() });
	return new Blob([u8], { type: "image/png" })
}
