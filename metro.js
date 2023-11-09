function geodesic_distance_in_km(coord1, coord2) {
    const earthRadius = 6371;
    const radLat1 = (Math.PI * coord1[0]) / 180;
    const radLon1 = (Math.PI * coord1[1]) / 180;
    const radLat2 = (Math.PI * coord2[0]) / 180;
    const radLon2 = (Math.PI * coord2[1]) / 180;
    const x = (radLon2 - radLon1) * Math.cos((radLat1 + radLat2) / 2);
    const y = radLat2 - radLat1;
    const distance = Math.sqrt(x * x + y * y) * earthRadius;
    return distance;
}

function lerp(a, b, t) { return t*(b-a) + a; }

// acc : km/h/s
// decc: km/h/s
// distance: km
// v_max: km/h
function speed_calculation(D, v_max = 45, acc = 3.6, decc = 3.6) {
    return (3600 * D / v_max) + (v_max / (2 * acc)) + (v_max / (2 * decc));
}

function hourminsec(seconds) {
    return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor((seconds / 60) % 60)).padStart(2, '0')}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
}

function minsec(seconds) {
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
}

function t(str) {
    return mins(parseInt(str.split(':')[0]), parseInt(str.split(':')[1]));
}

function mins(hour, mins) {
    return hour * 60 + mins;
}

class Station {
    constructor(name, gps, multiple_lines = []) {
        this.name = name;
        this.gps = gps;
        this.multiple_lines = multiple_lines.length > 1 ? multiple_lines : null;
    }

    toString() {
        return this.name;
    }

    isTransferStation() {
        return this.multiple_lines !== null;
    }
}

class Line {
    constructor(stations, name, color) {
        this.stations = stations;
        this.name = name;
        this.color = color;
        this.station_times_ = null;
    }

    station_move_info(from_index, to_index) {
        if (to_index < from_index) {
            const x = from_index;
            from_index = to_index;
            to_index = x;
        }
        if (to_index !== from_index + 1) {
            console.log("warning");
        }
        const from_sta = this.stations[from_index];
        const to_sta = this.stations[to_index];
        const dist = geodesic_distance_in_km(from_sta.gps, to_sta.gps);
        const time = speed_calculation(dist) / 60;
        return [from_sta.name, to_sta.name, dist, time];
    }

    print_distances_between_stations() {
        for (let i = 0; i < this.stations.length - 1; i++) {
            const [from_name, to_name, dist, time] = this.station_move_info(i, i + 1);
            console.log(`${from_name} -> ${to_name}: ${dist.toFixed(3)} km ~ ${time.toFixed(1)} min`);
        }
    }

    print_time_schedule(time_in_station = 20) {
        console.log(this.name);
        console.log("-----");
        let total_time = 0; // In seconds
        for (let i = 0; i < this.stations.length - 1; i++) {
            const [from_name, _0, _1, move_time] = this.station_move_info(i, i + 1);
            console.log(`${from_name}  ${minsec(total_time)}`);
            total_time += time_in_station + move_time * 60;
        }
        // Last station
        console.log(`${this.stations[this.stations.length - 1].name}  ${minsec(total_time)}`);
    }

    station_times() {
        if (this.station_times_ === null) {
            const times = [0];
            let total_time = 0; // In seconds
            for (let i = 0; i < this.stations.length - 1; i++) {
                const [_0, _1, _2, move_time] = this.station_move_info(i, i + 1);
                total_time += move_time * 60 + 20; // 20 second stop in station
                times.push(Math.round(total_time));
            }
            this.station_times_ = times;
        }
        return this.station_times_;
    }

    draw_stations_map(map) {
        const stationDrawOpts = {color: this.color, fillColor: this.color, fillOpacity: 1, radius: 30 };
        const connectionDrawOpts = { color: this.color };
        for (let i = 0; i < this.stations.length; i++) {
            // Draw connection (line)
            if (i != this.stations.length - 1) {
                L.polygon([this.stations[i].gps, this.stations[i+1].gps], connectionDrawOpts).addTo(map);
            }
            // Draw station
            if (this.stations[i].isTransferStation())
                this._draw_transfer_station(this.stations[i], map)
            else {
                const station = this.stations[i];
                let stat = L.circle(station.gps, stationDrawOpts)
                            .bindTooltip(station.name);
                stat.on('mouseover', (ev) => { 
                    ev.target.openTooltip();
                });
                stat.on('mouseout', (ev) => {
                    ev.target.closeTooltip();
                });
                stat.on('click', (ev) => {
                    GlobalUpdateTimetable(station)
                })
                stat.addTo(map);
            }
        }
    }

    _draw_transfer_station(station, map) {
        // Draw it only if this line is the first (to avoid duplicate drawing)
        if (!station.multiple_lines[0].startsWith(this.name)) return;
        // Draw a big circle followed by a smaller circle
        for (let i = station.multiple_lines.length-1; i >= 0; i--) {
            const element = station.multiple_lines[i];
            const color = '#' + element.split('#')[1];
            const circleRadius = 30 + i * 20;
            const drawOpts = {color: color, fillColor: color, fillOpacity: 1, radius: circleRadius };
            const stat = L.circle(station.gps, drawOpts)
            stat.bindTooltip(station.name);
            stat.on('mouseover', (ev) => { ev.target.openTooltip(); });
            stat.on('mouseout', (ev) => { ev.target.closeTooltip(); });
            stat.on('click', (ev) => { GlobalUpdateTimetable(station); })
            stat.addTo(map);
        }
    }

    time_to_station(n, reverse) {
        if (!reverse)
            return this.station_times()[n]
        else {
            const end_time = this.station_times()[this.stations.length - 1] + 20;
            return end_time - this.station_times()[n];
        }
    }
}

class Train {
    // Leave time is in seconds
    constructor(line, leave_time, reverse=false) {
        this.line = line
        this.leave_time = leave_time
        this.reverse = reverse
        this.line_length = line.station_times().slice(-1)[0] + 20;

        const opts = {color: 'black', fillColor: line.color, fillOpacity: 0.5, radius: 20 };
        this.icon = L.circle([0,0], opts);
    }

    isFinished(time) { return (time - this.leave_time) > this.line_length; }

    /**
     * Returns either null if the train is before departure of after arrival
     * or returns [station] if in station
     * or returns [station1, station2, t] where t is in <0,1>
     */
    getPositionAt(time) {
        // time is in seconds
        let dt = time - this.leave_time;
        if (dt < 0 || dt > this.line_length) return null;
        const station_times = this.line.station_times();
        if (this.reverse)
            dt = this.line_length - dt; // just "flip" the time!
        for (let i = station_times.length-1; i >= 0; i--) {
            const stat_time = station_times[i];
            if (dt >= stat_time) {
                // The train is in this station or on its way from here
                if (dt - stat_time <= 20) return [i]; // in station
                const next_stat_time = station_times[i+1];
                return [i, i+1, (dt-stat_time-20)/(next_stat_time - stat_time - 20)];
            }
        }
        return null;
    }

    draw(map, time) {
        const pos = this.getPositionAt(time);
        if (pos == null) {
            this.icon.removeFrom(map);
            return;
        }
        if (pos.length == 1) { // in station
            this.icon.setLatLng(this.line.stations[pos[0]].gps);
            this.icon.addTo(map);
            return;
        }
        if (pos.length == 3) { // between stations
            const [st1, st2, t_] = pos;
            const coord1 = this.line.stations[st1].gps;
            const coord2 = this.line.stations[st2].gps;
            // lerp
            const coord = [lerp(coord1[0], coord2[0], t_), lerp(coord1[1], coord2[1], t_)];
            this.icon.setLatLng(coord);
            this.icon.addTo(map);
            return;
        }
    }
}

class Schedule {
    constructor() {
        this.schedules = [];
        this.active_trains = [];
    }

    add_departures(line, times, reverse) {
        for (const t of times) {
            this.schedules.push({line: line, leaveTime: t, isReverse: reverse, departed: false});
        }
    }

    add_departures_every(line, from, until, period, reverse) {
        for (let t = from; t <= until; t += period)
            this.schedules.push({line: line, leaveTime: t, isReverse: reverse, departed: false});
    }

    updateAndDraw(map, time) {
        // remove finished trains
        for (let i = 0; i < this.active_trains.length; i++) {
            if (this.active_trains[i].isFinished()) {
                console.log(`Train on line ${this.active_trains[i].line.name} finished`);
                this.active_trains.splice(i, 1);
                i--;
            }
        }
        const minutesTime = Math.floor(time/60);
        // add new departures
        for (const departInfo of this.schedules) {
            if (minutesTime >= departInfo.leaveTime && !departInfo.departed) {
                const train = new Train(departInfo.line, departInfo.leaveTime*60, departInfo.isReverse);
                this.active_trains.push(train);
                departInfo.departed = true;
                console.log(`Train on line ${train.line.name} departed`);
            }
        }
        // update and draw
        for (let i = 0; i < this.active_trains.length; i++) {
            this.active_trains[i].draw(map, time);
        }
    }

    printTimetableForStation(station, fromTime, toTime) {
        const trains = []
        for (const departInfo of this.schedules) {
            const i = departInfo.line.stations.indexOf(station);
            if (i == -1) continue;
            let timeInStation = departInfo.leaveTime*60 + departInfo.line.time_to_station(i, departInfo.isReverse)
            let towards = departInfo.line.stations[departInfo.line.stations.length - 1];
            if (departInfo.isReverse)
                towards = departInfo.line.stations[0]
            if (towards.name == station.name) continue; // don't show arrivals
            if (timeInStation >= fromTime*60 && timeInStation <= toTime*60)
                trains.push({line: departInfo.line, at: timeInStation, towards: towards.name})
        }
        trains.sort((a, b) => a.at - b.at)
        return trains
    }

    displayTimetable(station, fromTime, toTime) {
        const trains = this.printTimetableForStation(station, fromTime, toTime);
        const schEl = document.getElementById("schedule");
        schEl.innerHTML = "";
        schEl.innerHTML += `<b>${station.name}</b>`;
        for (const train of trains) {
            const time = Math.round(train.at / 60);
            schEl.innerHTML += `<div id="schedule-row">
                <div class="box" style="background-color: ${train.line.color};"></div>
                ${minsec(time)} towards <b>${train.towards}</b></div>`;
        }
    }
}



const suche_vrbne = new Station('Suché Vrbné', [48.971126, 14.504384])
const nadrazi = new Station('Nádraží', [48.974960, 14.487348], ["Centrální#ff0060", "Přemyslovská#0079ff"]) // transfer
const sady = new Station('Sady', [48.976883, 14.476989], ["Centrální#ff0060", "Přemyslovská#0079ff"]) // transfer
const ctyri_dvory = new Station('Čtyři Dvory', [48.980648, 14.454624])
const vltava = new Station('Vltava', [48.990789, 14.451142])
const maj = new Station('Máj', [48.986339, 14.434966])
const depo_plzenska = new Station('Depo Plzeňská', [48.991015, 14.463519])
const prazske_predm = new Station('Pražské Předměstí', [48.983292, 14.477520])
const havlickova_kol = new Station('Havlíčkova kolonie', [48.966165, 14.478292], ["Centrální#ff0060", "Jižní#00dfa2"]) // transfer
const jungmannova = new Station('Jungmannova', [48.959198, 14.473540])
const roznov = new Station('Rožnov', [48.950095, 14.471624])
const mlade = new Station('Mladé', [48.958183, 14.489005])
const stromovka = new Station('Stromovka', [48.967678, 14.462698])
const litvinovice =  new Station('Litvínovice', [48.961778, 14.452863])
const letiste = new Station('Letiště', [48.947503, 14.443161])

const centralni = new Line([roznov, jungmannova, havlickova_kol, nadrazi, sady, prazske_predm, depo_plzenska], "Centrální", '#ff0060')
const premyslovska = new Line([suche_vrbne, nadrazi, sady, ctyri_dvory, vltava, maj], "Přemyslovská", '#0079ff')
const jizni = new Line([mlade, havlickova_kol, stromovka, litvinovice, letiste], "Jižní", '#00dfa2')

