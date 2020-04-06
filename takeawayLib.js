"use strict";

var Takeaway = (function () {

	var targets = [];

	return {
		get: function (keys) {				// 情報（アイコンなど）を地図に追加
			console.log("Takeaway: get start...");
			if (keys == undefined) {
				targets = [];
				for (let key in Defaults) targets.push(key);
			} else {
				targets = keys;
			};
			let ZoomLevel = map.getZoom();	// マップ範囲を探す
			if (ZoomLevel < MinZoomLevel) { console.log("MinZoomLevel..."); return false; }
			let maparea = '(' + LL.SE.lat + ',' + LL.NW.lng + ',' + LL.NW.lat + ',' + LL.SE.lng + ');';
			ProgressBar.show(0);

			let jqXHRs = [], Progress = 0;
			targets.forEach(key => {
				if (Defaults[key].init && Defaults[key].zoom <= ZoomLevel) {
					let query = "";
					for (let ovpass in OverPass[key]) { query += OverPass[key][ovpass] + maparea; }
					let url = OvServer + '?data=[out:json][timeout:30];(' + query + ');out body;>;out skel qt;';
					console.log("GET: " + url);
					jqXHRs.push($.get(url, function () {
						ProgressBar.show(Math.ceil(((++Progress + 1) * 100) / LayerCounts));
					}));
				}
			});

			$.when.apply($, jqXHRs).done(function () {
				let i = 0, arg;
				targets.forEach(key => {
					if (Defaults[key].init && Defaults[key].zoom <= ZoomLevel) {
						if (arguments[0][1] == undefined) {
							arg = arguments[1];
						} else {
							arg = arguments[i][1];
						};
						if (arg !== "success") { alert(OvGetError); return };
						let osmxml = arguments[i++][0]
						let geojson = osmtogeojson(osmxml, { flatProperties: true });
						geojson.features.forEach(function (val) { delete val.id; }); // delete Unnecessary osmid
						Layer_Data[key].geojson = geojson;
					}
				});
				Takeaway.update();
				console.log("Takeaway: end");
			}).fail(function (jqXHR, statusText, errorThrown) {
				console.log(statusText);
			});
		},

		view: function (tags) {
			console.log("Takeaway: View Start.");
			let catname, key1, key2;

			console.log(tags);

			$("#name").html(tags.name == null ? "" : tags.name);

			key1 = tags.amenity == null ? "shop" : "amenity";
			key2 = tags[key1] == null ? "" : tags[key1];
			if (key2 == "") {	 // unknown tags
				catname = "その他";
			} else {
				catname = Categorys[key1][key2];
			}
			$("#category").html(catname);
			$("#opening_hours").html(tags.opening_hours == null ? "" : tags.opening_hours);

			let delname = tags.delivery == null ? "" : Categorys.delivery[tags.delivery];
			$("#delivery").html(delname);

			let outseet = "";
			switch (tags.outdoor_seating) {
				case "yes": outseet = "あり"; break;
				case "no": outseet = "なし"; break;
			};
			$("#outdoor_seating").html(outseet);

			$("#phone").attr('href',tags.phone == null ? "" : "tel:" + tags.phone);
			$("#phone_view").html(tags.phone == null ? "" : tags.phone);

			$("#url").attr('href',tags.website == null ? "" : tags.website);
			$("#url_view").html(tags.website == null ? "" : tags.website);

			$("#description").html(tags.description == null ? "" : tags.description);

			$('#PoiView_Modal').modal({ backdrop: false, keyboard: false });
		},

		// Update Access Map(color/lime weight change)
		update: function (targetkey) {
			console.log("Takeaway: update... ");
			if (targetkey == "" || typeof (targetkey) == "undefined") {											// no targetkey then update all layer
				for (let key in Defaults) {
					Marker.del(key);
					Marker.set(key);
				}
			} else {
				Marker.del(targetkey);
				Marker.set(targetkey);
			}
			console.log("Takeaway: update... end ");
		}
	}
})();

// make LMarker
var Marker = (function () {
	var markers = [];

	return {
		set: function (key) {
			let geojson = Layer_Data[key].geojson;
			if (geojson !== undefined) {
				geojson.features.forEach(function (node) {
					let tags = node.properties;
					let icon = L.divIcon({ className: 'icon', html: '<img class="icon" src="' + Defaults[key].icon + '">' });
					if (node.geometry.type == "Polygon") {
						markers.push(L.marker(new L.LatLng(node.geometry.coordinates[0][0][1], node.geometry.coordinates[0][0][0]), { icon: icon, draggable: false }));
					} else {
						markers.push(L.marker(new L.LatLng(node.geometry.coordinates[1], node.geometry.coordinates[0]), { icon: icon, draggable: false }));
					}
					markers[markers.length - 1].addTo(map).on('click', e => Takeaway.view(e.target.takeaway_tags));
					markers[markers.length - 1].takeaway_tags = tags;
				});
				Layer_Data[key].markers = markers;
			}
		},

		del: function (key) {
			if (Layer_Data[key].markers !== undefined) {
				Layer_Data[key].markers.forEach(marker => { marker.remove(map) });
				markers = [];
			}
		}
	}
})();


// Progress Bar
var ProgressBar = (function () {
	return {
		show: function (percent) {
			$('#Progress_Bar').css('width', parseInt(percent) + "%");
			// $('#Progress_Modal').modal({ backdrop: "static", keyboard: false });
		},
		hide: function () {
			$('#Progress_Bar').css('width', "0%");
			// $('#Progress_Modal').modal("hide");
		}
	}
})();
