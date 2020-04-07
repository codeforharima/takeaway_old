"use strict";

var Takeaway = (function () {

	return {
		get: function (keys, callback) {				// 情報（アイコンなど）を地図に追加
			console.log("Takeaway: get start...");
			var targets = [];
			if (keys == undefined || keys == "") {
				for (let key in Defaults) targets.push(key);
			} else {
				targets = keys;
			};
			if (map.getZoom() < MinZoomLevel) { console.log("MinZoomLevel..."); return false; }

			OvPassCnt.get(targets).then(geojson => {
				targets.forEach(key => { Layer_Data[key].geojson = geojson[key] });
				Takeaway.update();
				console.log("Takeaway: get end");
				callback();
			}) //.catch((jqXHR, statusText, errorThrown)=> {
			//		console.log("Takeaway: Error. " + statusText);
			//	});
		},

		view: function (tags) {
			$("#name").html(tags.name == null ? "" : tags.name);
			$("#category").html(Takeaway.get_catname(tags));
			$("#opening_hours").html(tags.opening_hours == null ? "" : tags.opening_hours);

			let delname = tags.delivery == null ? "" : Categorys.delivery[tags.delivery];
			$("#delivery").html(delname);

			let outseet = "";
			switch (tags.outdoor_seating) {
				case "yes": outseet = "あり"; break;
				case "no": outseet = "なし"; break;
			};
			$("#outdoor_seating").html(outseet);

			$("#phone").attr('href', tags.phone == null ? "" : "tel:" + tags.phone);
			$("#phone_view").html(tags.phone == null ? "" : tags.phone);

			$("#url").attr('href', tags.website == null ? "" : tags.website);
			$("#url_view").html(tags.website == null ? "" : tags.website);

			$("#description").html(tags.description == null ? "" : tags.description);

			$('#PoiView_Modal').modal({ backdrop: false, keyboard: false });
		},

		// Update Access Map(color/lime weight change)
		update: function (targetkey) {
			if (targetkey == "" || typeof (targetkey) == "undefined") {		// no targetkey then update all layer
				for (let key in Defaults) {
					Marker.all_delete(key);
					Marker.set(key);
				}
			} else {
				Marker.all_delete(targetkey);
				Marker.set(targetkey);
			}
		},

		// get Category Name from Categorys(Global Variable)
		get_catname: function (tags) {
			let catname = "";
			var key1 = tags.amenity == undefined ? "shop" : "amenity";
			var key2 = tags[key1] == undefined ? "" : tags[key1];
			if (key2 !== "") {	 					// known tags
				catname = Categorys[key1][key2];
				if (catname == undefined) catname = "";
			}
			return catname;
		},

		// 2点間の距離を計算(参考: https://qiita.com/chiyoyo/items/b10bd3864f3ce5c56291)
		calc_between: function (ll1, ll2) {
			let pi = Math.PI, r = 6378137.0; 	// πと赤道半径
			let radLat1 = ll1.lat * (pi / 180);	// 緯度１
			let radLon1 = ll1.lng * (pi / 180);	// 経度１
			let radLat2 = ll2.lat * (pi / 180);	// 緯度２
			let radLon2 = ll2.lng * (pi / 180);	// 経度２
			let averageLat = (radLat1 - radLat2) / 2;
			let averageLon = (radLon1 - radLon2) / 2;
			return r * 2 * Math.asin(Math.sqrt(Math.pow(Math.sin(averageLat), 2) + Math.cos(radLat1) * Math.cos(radLat2) * Math.pow(Math.sin(averageLon), 2)));
		}
	}
})();

// OverPass Server Control(Width easy cache)
var OvPassCnt = (function () {

	var Cache = {};																// geojson cache area
	var LLc = { "NW": { "lat": 0, "lng": 0 }, "SE": { "lat": 0, "lng": 0 } };	// latlng cache area

	return {
		get: function (targets) {
			return new Promise((resolve, reject) => {
				let ZoomLevel = map.getZoom();
				if (LL.NW.lat < LLc.NW.lat && LL.NW.lng > LLc.NW.lng &&
					LL.SE.lat > LLc.SE.lat && LL.NW.lat < LLc.NW.lat) {
					// Within Cache range
					console.log("OvPassCnt: Cache Hit.");
					let RetCache = {};
					targets.forEach(key => {
						if (Defaults[key].init && Defaults[key].zoom <= ZoomLevel) {
							RetCache[key] = Cache[key];
						}
					});
					resolve(RetCache);

				} else {
					// Not With Cache range
					ProgressBar.show(0);
					Cache = {};	// Cache Clear
					let magni = (ZoomLevel - MinZoomLevel) < 1 ? 1 : (ZoomLevel - MinZoomLevel) / 2;
					let offset_lat = (LL.NW.lat - LL.SE.lat) * magni;
					let offset_lng = (LL.SE.lng - LL.NW.lng) * magni;
					let SE_lat = LL.SE.lat - offset_lat;
					let SE_lng = LL.SE.lng + offset_lng;
					let NW_lat = LL.NW.lat + offset_lat;
					let NW_lng = LL.NW.lng - offset_lng;
					let maparea = '(' + SE_lat + ',' + NW_lng + ',' + NW_lat + ',' + SE_lng + ');';
					LLc = { "SE": { "lat": SE_lat, "lng": SE_lng }, "NW": { "lat": NW_lat, "lng": NW_lng } };	// Save now LL(Cache area)

					let jqXHRs = [], Progress = 0;
					targets.forEach(key => {
						if (Defaults[key].init && Defaults[key].zoom <= ZoomLevel) {
							let query = "";
							for (let ovpass in OverPass[key]) { query += OverPass[key][ovpass] + maparea; }
							let url = OvServer + '?data=[out:json][timeout:30];(' + query + ');out body;>;out skel qt;';
							// console.log("GET: " + url);
							jqXHRs.push($.get(url, () => { ProgressBar.show(Math.ceil(((++Progress + 1) * 100) / LayerCounts)) }));
						};
					});
					$.when.apply($, jqXHRs).done(function () {
						let i = 0;
						targets.forEach(key => {
							if (Defaults[key].init && Defaults[key].zoom <= ZoomLevel) {
								let arg = arguments[0][1] == undefined ? arguments[1] : arguments[i][1];
								if (arg !== "success") { alert(OvGetError); reject() };
								let osmxml = arguments[i++][0]
								let geojson = osmtogeojson(osmxml, { flatProperties: true });
								geojson.features.forEach(function (val) { delete val.id; }); // delete Unnecessary osmid
								geojson = geojson.features.filter(val => {
									if (Takeaway.get_catname(val.properties) !== "") return val;
								});
								Cache[key] = { "features": geojson };
							}
						});
						console.log("OvPassCnt: Cache Update");
						resolve(Cache);
					}).fail(function (jqXHR, statusText, errorThrown) {
						console.log(statusText);
						reject(jqXHR, statusText, errorThrown);
					});
				};
			});
		}
	};
})();

// make LMarker
var Marker = (function () {
	const PointUp = { radius: 6, color: 'blue', fillColor: '#000080', fillOpacity: 0.2 };
	var latlngs = {};

	return {
		set: function (key) {
			let geojson = Layer_Data[key].geojson;
			let markers = [];
			if (geojson !== undefined) {
				geojson.features.forEach(function (node) {
					let tags = node.properties;
					let icon = L.divIcon({ className: 'icon', html: '<img class="icon" src="' + Defaults[key].icon + '">' });
					if (node.geometry.type == "Polygon") {
						latlngs[tags.id] = { "lat": node.geometry.coordinates[0][0][1], "lng": node.geometry.coordinates[0][0][0] };
					} else {
						latlngs[tags.id] = { "lat": node.geometry.coordinates[1], "lng": node.geometry.coordinates[0] };
					}
					markers.push(L.marker(new L.LatLng(latlngs[tags.id].lat, latlngs[tags.id].lng), { icon: icon, draggable: false }));
					markers[markers.length - 1].addTo(map).on('click', e => Takeaway.view(e.target.takeaway_tags));
					markers[markers.length - 1].takeaway_tags = tags;
				});
				Layer_Data[key].markers = markers;
			}
		},

		all_delete: function (key) {	// all delete
			if (Layer_Data[key].markers !== undefined) {
				Layer_Data[key].markers.forEach(marker => marker.remove(map));
				Layer_Data[key].markers = undefined;
			}
		},

		list: function (targets) {
			let datas = [];
			targets.forEach(key => {
				if (Layer_Data[key].markers !== undefined) {
					Layer_Data[key].markers.forEach(marker => {
						let tags = marker.takeaway_tags;
						let name = tags.name == undefined ? "-" : tags.name;
						let category = Takeaway.get_catname(tags);
						let between = Math.round(Takeaway.calc_between(latlngs[tags.id], map.getCenter()));
						datas.push({ "osmid": tags.id, "name": name, "category": category, "between": between });
					})
				};
			});
			return datas;
		},

		center: function (osmid) {
			map.panTo(latlngs[osmid]);
			let circle = L.circle(latlngs[osmid], PointUp).addTo(map);
			setTimeout(() => map.removeLayer(circle), 5000);
		}
	}
})();

// PoiDatalist管理
var DataList = (function () {
	var table;

	return {
		table: function () {
			return table;
		},

		view: function (targets) {		// PoiDataのリスト表示
			if (table !== undefined) {
				table.off('select');
				table.destroy();
			};

			let result = Marker.list(targets);
			table = $('#tableid').DataTable({
				"autoWidth": true,
				"columns": [{ title: "名前", data: "name" }, { title: "種類", data: "category" }, { title: "中心からの距離", data: "between" },],
				"columnDefs": [{ targets: 2, render: $.fn.dataTable.render.number(',', '.', 0, '', 'm') }],
				"data": result,
				"processing": true,
				"filter": true,
				"destroy": true,
				"deferRender": true,
				"dom": 't',
				"order": [[2, "asc"]],
				"ordering": true,
				"orderClasses": false,
				"paging": true,
				"processing": false,
				"pageLength": 100000,
				"select": true,
				"scrollCollapse": true,
				"scrollY": $("#dataid").height() + "px"
			});
			table.row(0).select();

			table.on('select', function (e, dt, type, indexes) {
				if (type === 'row') {
					var data = table.rows(indexes).data();
					console.log(data[0]);
					Marker.center(data[0].osmid);
					// do something with the ID of the selected items
				}
			});
		},

		select: function (osmid) {	// アイコンをクリックした時にデータを選択
			table.rows().deselect();
			let index = table.column(0).data().indexOf(parseInt(osmid));
			if (index >= 0) {
				table.row(index).select();
				table.row(index).node().scrollIntoView(true);
			}
		},

		filter: function (KEYWORD) {
			table.search(KEYWORD).draw();
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
