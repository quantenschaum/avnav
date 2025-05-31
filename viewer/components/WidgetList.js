/**
 * Created by andreas on 20.11.16.
 */
import AisTargetWidget from './AisTargetWidget.jsx';
import ActiveRouteWidget from './ActiveRouteWidget.jsx';
import EditRouteWidget from './EditRouteWidget.jsx';
import CenterDisplayWidget from './CenterDisplayWidget.jsx';
import WindWidget, {getWindData} from './WindWidget';
import XteWidget from './XteWidget';
import EmptyWidget from './EmptyWidget';
import WindGraphics from './WindGraphics';
import ZoomWidget from './ZoomWidget.jsx';
import keys from '../util/keys.jsx';
import AlarmWidget from './AlarmWidget.jsx';
import RoutePointsWidget from './RoutePointsWidget.jsx';
import {GaugeRadial} from './CanvasGauges.jsx';
import UndefinedWidget from './UndefinedWidget.jsx';
import {SKPitchWidget, SKRollWidget} from "./SKWidgets";
import assign from 'object-assign';
import {CombinedWidget} from "./CombinedWidget";

let widgetList=[
    {
        name: 'SOG',
        default: "---",
        unit: "kn",
        caption: 'SOG',
        storeKeys: {
            value: keys.nav.gps.speed,
            isAverage: keys.nav.gps.speedAverageOn
        },
        formatter:'formatSpeed',
        formatterParameters: ['kn'],
        editableParameters: {
            unit: false,
        },
        translateFunction: (props)=>{
            return {...props,
                unit: ((props.formatterParameters instanceof Array) && props.formatterParameters.length > 0) ? props.formatterParameters[0] : props.unit,
            }
        }
    },
    {
        name: 'COG',
        default: "---",
        unit: "\u00b0",
        caption: 'COG',
        storeKeys:{
            value: keys.nav.gps.course,
            isAverage:keys.nav.gps.courseAverageOn
        },
        formatter: 'formatDirection',
        editableParameters: {
            unit: false,
            formatterParameters: false
        }
    },
    {
        name: 'HDM',
        default: "---",
        unit: "\u00b0",
        caption: 'HDM',
        storeKeys:{
            value: keys.nav.gps.headingMag
        },
        formatter: 'formatDirection',
        editableParameters: {
            unit: false,
            formatterParameters: false
        }
    },
    {
        name: 'HDT',
        default: "---",
        unit: "\u00b0",
        caption: 'HDT',
        storeKeys:{
            value: keys.nav.gps.headingTrue
        },
        formatter: 'formatDirection',
        editableParameters: {
            unit: false,
            formatterParameters: false
        }
    },
    {
        name: 'Position',
        default: "---",
        caption: 'BOAT',
        storeKeys:{
            value: keys.nav.gps.position,
            isAverage: keys.nav.gps.positionAverageOn,
            gpsValid: keys.nav.gps.valid,
        },
        formatter: 'formatLonLats',
        translateFunction: (props)=>{
            return {...props,
              unit: props.gpsValid?'OK':'ERROR',
              addClass: props.gpsValid?'ok':'error',
            }
        },

    },
    {
        name: 'TimeStatus',
        caption: 'GPS',
        storeKeys:{
            value: keys.nav.gps.rtime,
            gpsValid: keys.nav.gps.valid,
        },
        formatter: 'formatTime',
        translateFunction: (props)=>{
            return {...props,
              unit: props.gpsValid?'OK':'ERROR',
              addClass: props.gpsValid?'ok':'error',
            }
        },
    },
    {
        name: 'ETA',
        caption: 'ETA',
        storeKeys:{
          eta: keys.nav.wp.eta,
          time:keys.nav.gps.rtime,
          name: keys.nav.wp.name
        },
        formatter: 'formatTime',
        translateFunction: (props)=>{
            return {...props,
              value: props.kind=='TTG'?new Date(props.eta-props.time):props.eta,
              unit: props.name,
              caption: props.kind,
            }
        },
        editableParameters: {
            unit: false,
            kind: {type:'SELECT',list:['ETA','TTG'],default:'ETA'},
        }
    },
    {
        name: 'DST',
        default: "---",
        unit: "nm",
        caption: 'DST',
        storeKeys:{
            value: keys.nav.wp.distance,
            server: keys.nav.wp.server
        },
        updateFunction: (state)=>{
            return {
                value: state.value,
                disconnect: state.server === false
            }
        },
        formatter: 'formatDistance',
        formatterParameters: ['nm'],
        editableParameters: {
            unit: false,
        },
        translateFunction: (props)=>{
            return {...props,
                unit: ((props.formatterParameters instanceof Array) && props.formatterParameters.length > 0) ? props.formatterParameters[0] : props.unit,
            }
        }

    },
    {
        name: 'BRG',
        default: "---",
        unit: "\u00b0",
        caption: 'BRG',
        storeKeys:{
            value: keys.nav.wp.course
        },
        formatter: 'formatDirection',
        editableParameters: {
            unit: false,
            formatterParameters: false
        }
    },
    {
        name: 'VMG',
        default: "---",
        unit: "kn",
        caption: 'VMG',
        storeKeys: {
            value: keys.nav.wp.vmg
        },
        formatter:'formatSpeed',
        formatterParameters: ['kn'],
        editableParameters: {
            unit: false,
        },
        translateFunction: (props)=>{
            return {...props,
                unit: ((props.formatterParameters instanceof Array) && props.formatterParameters.length > 0) ? props.formatterParameters[0] : props.unit,
            }
        }

    },
    {
        name: 'STW',
        default: '---',
        unit: 'kn',
        caption: 'STW',
        storeKeys:{
            value: keys.nav.gps.waterSpeed
        },
        formatter: 'formatSpeed',
        formatterParameters: ['kn'],
        editableParameters: {
            unit: false,
        },
        translateFunction: (props)=>{
            return {...props,
                unit: ((props.formatterParameters instanceof Array) && props.formatterParameters.length > 0) ? props.formatterParameters[0] : props.unit,
            }
        }
    },
    {
        name: 'WindAngle',
        default: "---",
        unit: "\u00b0",
        caption: 'Wind Angle',
        storeKeys:{
            windAngle:keys.nav.gps.windAngle,
            windAngleTrue: keys.nav.gps.trueWindAngle,
            windDirectionTrue: keys.nav.gps.trueWindDirection,
            visible: keys.properties.showWind,
        },
        formatter: 'formatDirection',
        editableParameters: {
            formatterParameters: true,
            value: false,
            caption: false,
            unit: false,
            kind: {type:'SELECT',list:['auto','trueAngle','trueDirection','apparent'],default:'auto'}
        },
        translateFunction: (props)=>{
            const captions={
                A:'AWA',
                TA: 'TWA',
                TD: 'TWD',
            };
            let wind=getWindData(props);
            return {...props,
              value:wind.windAngle,
              caption:captions[wind.suffix]
            }
        }
    },
    {
        name: 'WindSpeed',
        default: "---",
        unit: "kn",
        caption: 'Wind Speed',
        storeKeys:{
            windSpeed:keys.nav.gps.windSpeed,
            windSpeedTrue: keys.nav.gps.trueWindSpeed,
            visible: keys.properties.showWind,
        },
        formatter: 'formatSpeed',
        formatterParameters: ['kn'],
        editableParameters: {
            formatterParameters: true,
            value: false,
            caption: false,
            unit: false,
            kind: {type:'SELECT',list:['auto','true','apparent'],default:'auto'}
        },
        translateFunction: (props)=>{
            const captions={
                A:'AWS',
                TA: 'TWS',
                TD: 'TWS',
            };
            let wind=getWindData(props);
            return {...props,
                value:wind.windSpeed,
                caption:captions[wind.suffix],
                unit: ((props.formatterParameters instanceof Array) && props.formatterParameters.length > 0) ? props.formatterParameters[0] : props.unit,
            }
        }
    },
    {
        name: 'WaterTemp',
        default: '---',
        unit: '°',
        caption: 'Water Temp',
        storeKeys: {
            value: keys.nav.gps.waterTemp
        },
        formatter: 'formatTemperature',
        formatterParameters: 'celsius'
    },
    {
        name: 'AnchorBearing',
        default: "---",
        unit: "\u00b0",
        caption: 'ACHR-BRG',
        storeKeys:{
            value:keys.nav.anchor.direction
        },
        formatter: 'formatDirection',
        editableParameters: {
            unit: false,
            formatterParameters: false
        }
    },
    {
        name: 'AnchorDistance',
        default: "---",
        unit: "m",
        caption: 'ACHR-DST',
        storeKeys:{
            value:keys.nav.anchor.distance
        },
        formatter: 'formatDistance',
        formatterParameters: ['m'],
        editableParameters: {
            unit: false,
        },
        translateFunction: (props)=>{
            return {...props,
                unit: ((props.formatterParameters instanceof Array) && props.formatterParameters.length > 0) ? props.formatterParameters[0] : props.unit,
            }
        }
    },
    {
        name: 'AnchorWatchDistance',
        default: "---",
        unit: "m",
        caption: 'ACHR-WATCH',
        storeKeys:{
            value:keys.nav.anchor.watchDistance
        },
        formatter: 'formatDecimal',
        formatterParameters: [3,1],
    },

    {
        name: 'RteDistance',
        default: "---",
        unit: "nm",
        caption: 'RTE-Dst',
        storeKeys:{
            value:keys.nav.route.remain
        },
        formatter: 'formatDistance',
        formatterParameters: ['nm'],
        editableParameters: {
            unit: false,
        },
        translateFunction: (props)=>{
            return {...props,
                unit: ((props.formatterParameters instanceof Array) && props.formatterParameters.length > 0) ? props.formatterParameters[0] : props.unit,
            }
        }
    },
    {
        name: 'RteEta',
        default: " --:--:-- ",
        unit: "h",
        caption: 'RTE-ETA',
        storeKeys:{
            value:keys.nav.route.eta
        },
        formatter: 'formatTime'
    },
    {
        name: 'LargeTime',
        default: "--:--",
        caption: 'Time',
        storeKeys:{
            value:keys.nav.gps.rtime,
            gpsValid: keys.nav.gps.valid,
            visible: keys.properties.showClock
        },
        formatter: 'formatClock',
        translateFunction: (props)=>{
            return {...props,
              unit: props.gpsValid?'OK':'ERROR',
              addClass: props.gpsValid?'ok':'error',
            }
        },
    },
    {
        name: 'WpPosition',
        default: "-------------",
        caption: 'MRK',
        storeKeys:{
            value:keys.nav.wp.position,
            server: keys.nav.wp.server
        },
        updateFunction: (state)=>{
            return {
                value: state.value,
                disconnect: state.server === false
            }

        },
        formatter: 'formatLonLats'
    },
    {
        name: 'Zoom',
        caption: 'Zoom',
        wclass: ZoomWidget,
        storeKeys: ZoomWidget.storeKeys
    },
    {
        name: 'AisTarget',
        wclass: AisTargetWidget,
        storeKeys: AisTargetWidget.storeKeys
    },
    {
        name: 'ActiveRoute',
        wclass: ActiveRouteWidget,
        storeKeys: ActiveRouteWidget.storeKeys
    },
    {
        name: 'EditRoute',
        wclass: EditRouteWidget,
        storeKeys: EditRouteWidget.storeKeys
    },
    {
        name: 'CenterDisplay',
        caption: 'Center',
        wclass: CenterDisplayWidget,
        storeKeys: CenterDisplayWidget.storeKeys
    },
    {
        name: 'WindDisplay',
        caption: 'Wind',
        wclass: WindWidget,
        storeKeys: WindWidget.storeKeys,
        formatter: WindWidget.formatter,
    },
    {
        name: 'WindGraphics',
        wclass: WindGraphics,
        storeKeys: WindGraphics.storeKeys,
        formatter: WindGraphics.formatter,
    },
    {
        name: 'DepthDisplay',
        default: "---",
        caption: 'DPT',
        unit: 'm',
        storeKeys:{
            DBK: keys.nav.gps.depthBelowKeel,
            DBS: keys.nav.gps.depthBelowWaterline,
            DBT: keys.nav.gps.depthBelowTransducer,
            visible: keys.properties.showDepth,
        },
        formatter: 'formatDistance',
        formatterParameters: ['m'],
        translateFunction: (props)=>{
            let kind=props.kind;
            if(kind=='auto') {
              kind='DBT';
              if(props.DBK !== undefined) kind='DBK';
              if(props.DBS !== undefined) kind='DBS';
            }
            let depth=undefined;
            if(kind=='DBT') depth=props.DBT;
            if(kind=='DBK') depth=props.DBK;
            if(kind=='DBS') depth=props.DBS;
            return {...props,
              value: depth,
              caption: kind,
              unit: ((props.formatterParameters instanceof Array) && props.formatterParameters.length > 0) ? props.formatterParameters[0] : props.unit,
            }
        },
        editableParameters:{
            formatterParameters: true,
            unit: false,
            value: false,
            caption: false,
            kind: {type:'SELECT',list:['auto','DBT','DBK','DBS'],default:'auto'}
        },
    },
    {
        name: 'XteDisplay',
        wclass: XteWidget,
        storeKeys: XteWidget.storeKeys
    },
    {
        name: "DateTime",
        caption: 'Date/Time',
        storeKeys:{
            value:keys.nav.gps.rtime
        },
        formatter: 'formatDateTime'
    },
    {
        name: 'Empty',
        wclass: EmptyWidget
    },
    {
        name: 'RteCombine',
        wclass: CombinedWidget,
        caption: '',
        children: [{name:'RteDistance'},{name:'RteEta'}],
        editableParameters:{
            formatter: false,
            unit: false,
            formatterParameters: false,
            value: false,
            caption: false,
            children: false
        }
    },
    {
        name: 'CombinedWidget',
        wclass: CombinedWidget
    },
    {
        name: 'Alarm',
        wclass:AlarmWidget,
        storeKeys: AlarmWidget.storeKeys
    },
    {
        name: 'RoutePoints',
        wclass: RoutePointsWidget,
        storeKeys: RoutePointsWidget.storeKeys
    },
    {
        name: 'Default', //a way to access the default widget providing all parameters in the layout
        default: "---",
    },
    {
        name: 'RadialGauge',
        wclass: GaugeRadial,
        editableParameters: {
            minValue: {type:'NUMBER',default:0},
            maxValue: {type:'NUMBER',default: 100}
        }
    },
    {
        name: 'Undefined',
        wclass: UndefinedWidget
    },
    {
        name: 'signalKPressureHpa',
        default: "---",
        unit: 'hPa',
        formatter: 'skPressure'
    },
    {
        name:'signalKCelsius',
        default: "---",
        unit:'°',
        formatter: 'skTemperature'
    },
    {
        name: 'signalKRoll',
        wclass: SKRollWidget
    },
    {
        name: 'signalKPitch',
        wclass: SKPitchWidget
    }



];

export default widgetList;
