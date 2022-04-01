'use strict'

function type(d) {
    let timeFormat = d3.timeFormat('%Y-%b-%d');
    let parseNA = string => (string === 'NA' ? undefined : string);

    return {
        entry: parseNA(d.entry),
        date: timeFormat(new Date(d.date) ),
        datetime: new Date(d.date),
        year: new Date(d.date).getFullYear(),
        lon: parseFloat(d.lon),
        lat: parseFloat(d.lat)
    }
}

Promise.all([
    d3.csv('data/jqa-geoReference.csv', type),
    d3.json('../../config.json')
])
.then(([data, config]) => {
    console.log(data);

    // Read in access key from config.json.
    let mapBoxAccessToken = config.map_key;

    let map = L.map('leaflet-map').setView([37.8, -96], 4); // .setView([0, 0], 0);

    L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=' + mapBoxAccessToken, {
        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        minZoom: 1,
        maxZoom: 18,
        id: 'mapbox/streets-v11',
        tileSize: 512,
        zoomOffset: -1,
    }).addTo(map);

    // Append data points to map as markers.
    // https://leaflet.github.io/Leaflet.markercluster/example/marker-clustering-realworld.10000.html
    let markers = L.markerClusterGroup({ chunkedLoading: true });

    for (let i = 0; i < data.length; i++) {
        let item = data[i];

        let marker = new L.marker(L.latLng([item.lat, item.lon]));
        
        markers.addLayer(marker);

    }

    map.addLayer(markers);

}) // end.