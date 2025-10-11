/**
 * Created by andreas on 20.11.16.
 */
import AisTargetWidget from './AisTargetWidget.jsx';
import ActiveRouteWidget from './ActiveRouteWidget.jsx';
import EditRouteWidget from './EditRouteWidget.jsx';
import CenterDisplayWidget from './CenterDisplayWidget.jsx';
import WindWidget, {getWindData, WindStoreKeys} from './WindWidget';
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
import {CombinedWidget} from "./CombinedWidget";
import Formatter from "../util/formatter";
let widgetList=[
    {
        name: 'SOG',
        default: "---",
        caption: 'SOG',
        storeKeys: {
            value: keys.nav.gps.speed,
            isAverage: keys.nav.gps.speedAverageOn
        },
        editableParameters: {
            unit:false
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
        formatter: 'formatDirection360',
        editableParameters: {
            unit: false,
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
        formatter: 'formatDirection360',
        editableParameters: {
            unit: false,
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
        formatter: 'formatDirection360',
        editableParameters: {
            unit: false,
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
        formatter: 'formatDirection360',
        editableParameters: {
            unit: false,
            formatterParameters: true
        }
    },
    {
        name: 'VMG',
        default: "---",
        caption: 'VMG',
        storeKeys: {
            value: keys.nav.wp.vmg
        },
        editableParameters: {
            unit:false
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
        caption: 'STW',
        storeKeys:{
            value: keys.nav.gps.waterSpeed
        },
        editableParameters: {
            unit:false
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
        storeKeys:WindStoreKeys,
        formatter: 'formatString',
        editableParameters: {
            formatterParameters: true,
            formatter: false,
            value: false,
            caption: false,
            unit: false,
            kind: {type:'SELECT',list:['auto','trueAngle','trueDirection','apparent'],default:'auto'},
            show360: {type:'BOOLEAN',default: false,description:'always show 360°'},
            leadingZero:{type:'BOOLEAN',default: false,description:'show leading zeroes (012)'}
        },
        translateFunction: (props)=>{
            const captions={
                A:'AWA',
                TA: 'TWA',
                TD: 'TWD',
            };
            const formatter={
                A: (v)=>Formatter.formatDirection(v,undefined,!props.show360,props.leadingZero),
                TD: (v)=>Formatter.formatDirection(v,undefined,false,props.leadingZero),
                TA:(v)=>Formatter.formatDirection(v,undefined,!props.show360,props.laedingZero),
            }
            let wind=getWindData(props);
            const fmt=formatter[wind.suffix];
            let value;
            if (!fmt) value=Formatter.formatDirection(wind.windAngle);
            else value=fmt(wind.windAngle);
            return {...props,
              value:value,
              caption:captions[wind.suffix]
            }
        }
    },
    {
        name: 'WindSpeed',
        default: "---",
        unit: "kn",
        caption: 'Wind Speed',
        storeKeys:WindStoreKeys,
        formatter: 'formatSpeed',
        formatterParameters: ['kn'],
        editableParameters: {
            formatter: false,
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
        formatter: 'formatDirection360',
        editableParameters: {
            unit: false,
            formatterParameters: true
        }
    },
    {
        name: 'AnchorDistance',
        default: "---",
        caption: 'ACHR-DST',
        storeKeys:{
            value:keys.nav.anchor.distance
        },
        editableParameters: {
            unit:false
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
        caption: 'ACHR-WATCH',
        storeKeys:{
            value:keys.nav.anchor.watchDistance
        },
        editableParameters: {
            unit:false
        },
        formatter: 'formatDistance',
        formatterParameters: ['m'],
    },

    {
        name: 'RteDistance',
        default: "---",
        caption: 'RTE-Dst',
        storeKeys:{
            value:keys.nav.route.remain
        },
        editableParameters: {
            unit:false
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
    },
    {
        name: 'AisTarget',
        wclass: AisTargetWidget,
    },
    {
        name: 'ActiveRoute',
        wclass: ActiveRouteWidget,
    },
    {
        name: 'EditRoute',
        wclass: EditRouteWidget,
    },
    {
        name: 'CenterDisplay',
        wclass: CenterDisplayWidget
    },
    {
        name: 'WindDisplay',
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
        locked:true,
        editableParameters:{
            formatter: false,
            unit: false,
            formatterParameters: false,
            value: false,
            caption: false,
            children: false,
            locked: false
        }
    },
    {
        name: 'CombinedWidget',
        wclass: CombinedWidget
    },
    {
        name: 'Alarm',
        wclass:AlarmWidget,
    },
    {
        name: 'RoutePoints',
        wclass: RoutePointsWidget,
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
        formatter: 'skPressure',
        editableParameters: {
            unit:false
        },
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
