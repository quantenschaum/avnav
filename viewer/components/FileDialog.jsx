/**
 *###############################################################################
 # Copyright (c) 2012-2020 Andreas Vogel andreas@wellenvogel.net
 #
 #  Permission is hereby granted, free of charge, to any person obtaining a
 #  copy of this software and associated documentation files (the "Software"),
 #  to deal in the Software without restriction, including without limitation
 #  the rights to use, copy, modify, merge, publish, distribute, sublicense,
 #  and/or sell copies of the Software, and to permit persons to whom the
 #  Software is furnished to do so, subject to the following conditions:
 #
 #  The above copyright notice and this permission notice shall be included
 #  in all copies or substantial portions of the Software.
 #
 #  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 #  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 #  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 #  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHERtime
 #  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 #  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 #  DEALINGS IN THE SOFTWARE.
 #
 ###############################################################################
 */
import React, {useEffect, useState} from "react";
import keys from '../util/keys.jsx';
import {Input, InputSelect, Radio} from "./Inputs";
import DB from "./DialogButton";
import Requests from "../util/requests";
import Toast from "./Toast";
import EditOverlaysDialog, {KNOWN_OVERLAY_EXTENSIONS,DEFAULT_OVERLAY_CHARTENTRY} from "./EditOverlaysDialog";
import OverlayDialog, {
    DialogButtons,
    DialogFrame,
    dialogHelper,
    DialogRow,
    InfoItem,
    showPromiseDialog
} from "./OverlayDialog";
import globalStore from "../util/globalstore";
import ViewPage from "../gui/ViewPage";
import assign from 'object-assign';
import LayoutHandler from "../util/layouthandler";
import base from "../base";
import NavHandler from "../nav/navdata";
import Helper from '../util/helper';
import UserAppDialog from "./UserAppDialog";
import DownloadButton from "./DownloadButton";
import {TrackConvertDialog} from "./TrackInfoDialog";
import {getTrackInfo,INFO_ROWS as TRACK_INFO_ROWS} from "./TrackInfoDialog";
import {getRouteInfo,INFO_ROWS as ROUTE_INFO_ROWS} from "./RouteInfoDialog";
import RouteEdit from "../nav/routeeditor";
import mapholder from "../map/mapholder";
import LogDialog from "./LogDialog";
import Formatter from '../util/formatter';
import routeobjects from "../nav/routeobjects";
import PropertyHandler from "../util/propertyhandler";

const RouteHandler=NavHandler.getRoutingHandler();
/**
 * additional parameters that should be included in server requests
 * if they are set at the item
 * @type {{url: boolean, chartKey: boolean}}
 */
export const additionalUrlParameters={
    url:true,
    chartKey:true
}

export const ItemDownloadButton=(props)=>{
    let {item,...forwards}=props;
    if (item.canDownload === false) return null;
    let localData=getLocalDataFunction(item);
    return <DownloadButton
        {...forwards}
        url={localData?undefined:getDownloadUrl(item)}
        fileName={getDownloadFileName(item)}
        localData={localData}
        type={item.type}
        androidUrl={item.url}
        />
}
const getLocalDataFunction=(item)=>{
    if (item.type === 'route' && ! item.server){
        return ()=>{ return RouteHandler.getLocalRouteXml(item.name)}
    }
    if (item.type === 'layout'){
        return LayoutHandler.getLocalDownload(item.name);
    }
}
const getDownloadFileName=(item)=>{
    let actions=ItemActions.create(item,false);
    return actions.nameForDownload(item.name);
}
const getDownloadUrl=(item)=>{
    let name=item.name;
    if (item.type==='route') {
        if (item.server === false) return;
        if (! name.match(/\.gpx$/)) name+=".gpx";
    }
    let url=globalStore.getData(keys.properties.navUrl)+"?request=download&type="+
        encodeURIComponent(item.type)+"&name="+
        encodeURIComponent(name)+"&filename="+encodeURIComponent(getDownloadFileName(item));
    for (let k in additionalUrlParameters){
        if (item[k] !== undefined){
            url+="&"+k+"="+encodeURIComponent(item[k])
        }
    }
    return url;
}

const showConvertFunctions = {
    track: (history,item) => {
        TrackConvertDialog.showDialog(history,item.name);
    }
}

export class ItemActions{
    constructor(type) {
        this.type=type;
        this.headline=type
        this.showEdit=false;
        this.showView=false;
        this.showDelete=false;
        this.showRename=false;
        this.showApp=false;
        this.isApp=false;
        this.showOverlay=false;
        this.showScheme=false;
        this.showConvertFunction=undefined;
        this.showImportLog=false;
        this.showDownload=false;
        this.showIsServer=false;
        this.timeText='';
        this.infoText='';
        this.className='';
        this.extForView='';
        /**
         * if this is set call this function to upload a new item
         * instead of the normal server upload
         * the function must expect name and data and optonally an overwrite flag
         * as parameters and return a promise
         * the resolves true when the upload succeeds
         * @type {undefined}
         */
        this.localUploadFunction=undefined;
        /**
         * convert an entity name as received from the server to a name we offer when downloading
         * @param name
         * @returns {*}
         */
        this.nameForDownload=(name)=>name;
        /**
         * convert a local file name into an entity name as the server would create
         * @param name
         * @returns {*}
         */
        this.nameForUpload=(name)=>name;
    }
    static create(props,isConnected){
        if (typeof(props) === 'string') props={type:props};
        if (! props || ! props.type){
            return new ItemActions();
        }
        let rt=new ItemActions(props.type);
        let ext=Helper.getExt(props.name);
        let viewable=ViewPage.VIEWABLES.indexOf(ext)>=0;
        let editableSize=props.size !== undefined && props.size < ViewPage.MAXEDITSIZE;
        let allowedOverlay=KNOWN_OVERLAY_EXTENSIONS.indexOf(Helper.getExt(props.name,true)) >= 0;
        let canEditOverlays=globalStore.getData(keys.gui.capabilities.uploadOverlays) && isConnected;
        if (props.time !== undefined) {
            rt.timeText=Formatter.formatDateTime(new Date(props.time*1000));
        }
        rt.infoText=props.name;
        if (props.active){
            rt.className+=' activeEntry';
        }
        rt.extForView=ext;
        switch (props.type){
            case 'chart':
                rt.headline='Charts';
                rt.showDelete=props.canDelete && isConnected;
                rt.showOverlay=canEditOverlays;
                rt.showScheme=isConnected && props.url && props.url.match(/.*mbtiles.*/);
                rt.showImportLog=props.hasImportLog;
                rt.showDownload=props.canDelete;
                if (props.originalScheme){
                    rt.className+=' userAction';
                }
                break;
            case 'track':
                rt.headline='Tracks';
                rt.showDelete=true;
                rt.showDownload=true;
                rt.showView=viewable;
                rt.showConvertFunction=ext === 'gpx'?showConvertFunctions[props.type]:undefined;
                rt.showOverlay=allowedOverlay && canEditOverlays;
                break;
            case 'route':
                rt.headline='Routes';
                rt.showIsServer=props.server;
                rt.showDelete= ! props.active &&  props.canDelete !== false  && ( ! props.isServer || isConnected);
                rt.showView=viewable;
                rt.showEdit=mapholder.getCurrentChartEntry() !== undefined;
                rt.showOverlay=canEditOverlays;
                rt.showDownload=true;
                rt.extForView='gpx';
                rt.infoText+=","+Formatter.formatDecimal(props.length,4,2)+
                    " nm, "+props.numpoints+" points";
                rt.nameForDownload=(name)=>{
                    if (! name.match(/\.gpx$/)) name+=".gpx";
                    return name;
                }
                rt.nameForUpload=(name)=>{
                    return name.replace(/\.gpx$/,'');
                }
                rt.localUploadFunction=(name,data)=>{
                    //name is ignored
                    try{
                        let route=new routeobjects.Route("");
                        route.fromXml(data);
                        if (! route.name){
                            return Promise.reject("route has no name");
                        }
                        return RouteHandler.saveRoute(route);
                    } catch(e){
                        return Promise.reject(e);
                    }
                }
                break;
            case 'layout':
                rt.headline='Layouts';
                rt.showDelete=isConnected && props.canDelete !== false && ! props.active;
                rt.showView = true;
                rt.showEdit = isConnected && editableSize && props.canDelete;
                rt.showDownload = true;
                rt.extForView='json';
                rt.nameForDownload=(name)=>{
                    return LayoutHandler.nameToBaseName(name)+".json";
                }
                rt.nameForUpload=(name)=>{
                    return LayoutHandler.fileNameToServerName(name);
                }
                rt.localUploadFunction=(name,data,overwrite)=>{
                    return LayoutHandler.uploadLayout(name,data,overwrite);
                }
                break;
            case 'settings':
                rt.headline='Settings';
                rt.showDelete=isConnected && props.canDelete !== false && ! props.active;
                rt.showView = true;
                rt.showEdit = isConnected && editableSize && props.canDelete;
                rt.showDownload = true;
                rt.showRename=isConnected && props.canDelete;
                rt.extForView='json';
                rt.nameForDownload=(name)=>{
                    return name.replace(/^user\./,'').replace(/^system\./,'').replace(/^plugin/,'')+".json";
                }
                rt.nameForUpload=(name)=>{
                    let serverName=name;
                    ['user','system','plugin'].forEach((prefix)=>{
                        if (serverName.indexOf(prefix+".") === 0){
                            serverName=serverName.substr(prefix.length+1);
                        }
                    });
                    return 'user.'+serverName.replace(/\.json$/,'');
                }
                rt.localUploadFunction=(name,data,overwrite)=>{
                   return PropertyHandler.verifySettingsData(data, true,true)
                       .then((res) => PropertyHandler.uploadSettingsData(name,res.data,false,overwrite));
                }
                break;
            case 'user':
                rt.headline='User';
                rt.showDelete=isConnected && props.canDelete;
                rt.showRename=isConnected && props.canDelete;
                rt.showView=viewable;
                rt.showEdit=editableSize && ViewPage.EDITABLES.indexOf(ext) >=0 && props.canDelete && isConnected;
                rt.showDownload=true;
                rt.showApp=isConnected && ext === 'html' && globalStore.getData(keys.gui.capabilities.addons);
                rt.isApp=rt.showApp && props.isAddon;
                break;
            case 'images':
                rt.headline='Images';
                rt.showDelete = isConnected && props.canDelete !== false;
                rt.showView = viewable;
                rt.showRename = isConnected && props.canDelete !== false;
                rt.showDownload=true;
                break;
            case 'overlay':
                rt.headline='Overlays';
                rt.showDelete = isConnected && props.canDelete !== false;
                rt.showView = viewable;
                rt.showRename = isConnected && props.canDelete !== false;
                rt.showDownload=true;
                rt.showEdit= editableSize && ViewPage.EDITABLES.indexOf(ext) >=0 && isConnected;
                rt.showOverlay = canEditOverlays && allowedOverlay;
                break;
        }
        return rt;
    }
}

const getImportLogUrl=(name)=>{
    return globalStore.getData(keys.properties.navUrl)+
        "?request=api&type=import&command=getlog&name="+encodeURIComponent(name);
}


class AddRemoveOverlayDialog extends React.Component{
    constructor(props) {
        super(props);
        this.state={};
        this.state.chartList=[DEFAULT_OVERLAY_CHARTENTRY];
        this.state.chart=DEFAULT_OVERLAY_CHARTENTRY.chartKey
        this.state.action='add';
        this.state.changed=false;
        this.titles={add:"Add to Charts",remove:"Remove from Charts"}
        this.dialogHelper=dialogHelper(this);
    }
    componentDidMount() {
        Requests.getJson('',{},{
            request:'list',
            type:'chart'
        })
            .then((data)=>{
                this.setState({
                    chartList:this.state.chartList.concat(data.items)
                })
            })
            .catch((error)=>Toast("unable to read chart list: "+error));
    }

    action(){
        if (this.state.action === 'remove'){
            Requests.getJson('',{},{
                request: 'api',
                type:'chart',
                command:'deleteFromOverlays',
                name:this.props.current.name,
                itemType:this.props.current.type
            })
                .then(()=>{})
                .catch((error)=>{Toast(error)})
            return;
        }
        if (this.state.action === 'add'){
            let chart=this.findChart(this.state.chart);
            if (! chart) return;
            EditOverlaysDialog.createDialog(chart,
                undefined,
                this.props.current
                );
            return;
        }
    }
    findChart(chartKey){
        for (let i=0;i<this.state.chartList.length;i++){
            if (this.state.chartList[i].chartKey === chartKey) return this.state.chartList[i];
        }
    }
    getChartSelectionList(){
        if (this.state.action === 'remove'){
            return {label:DEFAULT_OVERLAY_CHARTENTRY.name,value:DEFAULT_OVERLAY_CHARTENTRY.chartKey};
        }
        let rt=[];
        this.state.chartList.forEach((chart)=>{
            if (! chart.chartKey) return;
            rt.push({label:chart.name,value:chart.chartKey});
        })
        return rt;
    }
    getCurrentChartValue(){
        if (this.state.action === 'remove'){
            return {label:'All Charts',value:undefined};
        }
        return(
            {
                label:(this.findChart(this.state.chart) || {}).name,
                value:this.state.chart
            })
    }
    render(){
        return (
            <div className="AddRemoveOverlayDialog flexInner">
                <h3 className="dialogTitle">On Charts</h3>
                <div className={"dialogRow"}>
                    <span className="itemInfo">{this.props.current.name}</span>
                </div>
                <Radio
                    dialogRow={true}
                    label={"Action"}
                    value={this.state.action}
                    onChange={(v)=>{this.setState({changed:true,action:v})}}
                    itemList={[{label:this.titles.add,value:"add"},{label:this.titles.remove,value:"remove"}]}
                    />
                <InputSelect
                    dialogRow={true}
                    label="Chart"
                    value={this.getCurrentChartValue()}
                    onChange={(v) => {
                        this.setState({changed: true, chart: v})
                    }}
                    changeOnlyValue={true}
                    showDialogFunction={this.dialogHelper.showDialog}
                    itemList={this.getChartSelectionList()}
                />
                <div className="dialogButtons">
                    <DB name="cancel"
                        onClick={()=>{
                            this.props.closeCallback();
                        }}
                        >Cancel</DB>
                    <DB name="ok"
                        onClick={()=>{
                            this.action();
                            this.props.closeCallback()
                        }}>Ok</DB>
                </div>
            </div>
        )
    }
}
const INFO_ROWS=[

];
const TYPE_INFO_ROWS={
    track: TRACK_INFO_ROWS,
    route: ROUTE_INFO_ROWS
}
const INFO_FUNCTIONS={
    track: getTrackInfo,
    route: getRouteInfo
};
const infoRowDisplay=(row,data)=>{
    let v=data[row.value];
    if (v === undefined) return null;
    if (row.formatter) v=row.formatter(v,data);
    if (v === undefined) return null;
    return <InfoItem label={row.label} value={v}/>
}
export const FileDialog =(props)=>{
        const [changed,setChanged]=useState(false);
        const [existingName,setExistingName]=useState(false);
        const [name,setName]=useState(props.current.name);
        const [scheme,setScheme]=useState(props.current.scheme);
        const [allowed,setAllowed]=useState(ItemActions.create(props.current,globalStore.getData(keys.properties.connectedMode,true)))
        const [extendedInfo,setExtendedInfo]=useState({});
    useEffect(() => {
        let f=INFO_FUNCTIONS[props.current.type];
        if (f){
            f(props.current.name).then((info)=>{
                setExtendedInfo(info);
            }).catch(()=>{});
        }
    }, []);

    const onChange=(newName)=>{
        if (newName === name) return;
        if (newName === props.current.name){
            setChanged(false);
            setExistingName(false);
            setName(newName);
            return;
        }
        setName(newName);
        setChanged(true);
        if (props.checkName) setExistingName(props.checkName(newName));
    }
        let cn=existingName?"existing":"";
        let rename=changed && ! existingName && (name !== props.current.name);
        let schemeChanged=allowed.showScheme && (((props.current.scheme||"tms") !== scheme)|| props.current.originalScheme);
        let extendedInfoRows=TYPE_INFO_ROWS[props.current.type];
        return(
            <DialogFrame className="fileDialog" title={props.current.name}>
                    {props.current.info !== undefined?
                        <DialogRow>
                            <span className="itemInfo">{props.current.info}</span>
                        </DialogRow>
                        :
                        null
                    }
                    {INFO_ROWS.map((row)=>{
                        return infoRowDisplay(row,props);
                    })}
                    {extendedInfoRows && extendedInfoRows.map((row)=>{
                        return infoRowDisplay(row,extendedInfo);
                    })}
                    {(allowed.showScheme && props.current.originalScheme) &&
                    <DialogRow className="userAction">
                    <span className="inputLabel">
                        original DB scheme
                    </span>
                        <span className="value">
                        {props.current.originalScheme}
                    </span>

                    </DialogRow>
                    }
                    {allowed.showScheme &&
                    <Radio
                        label="scheme"
                        value={scheme}
                        onChange={(v)=>{setChanged(true);setScheme(v)}}
                        itemList={[{label:"xyz",value:"xyz"},{label:"tms",value:"tms"}]}
                        className="mbtilesType"/>

                    }
                    {allowed.showRename ?
                        <div className="dialogRow">
                            <Input
                                label={existingName?"existing":"new name"}
                                className={cn}
                                value={name}
                                onChange={onChange}
                            />
                        </div>
                        : null
                    }
                    <DialogButtons>
                        {(allowed.showRename || allowed.showScheme)?
                            <DB name="ok"
                                onClick={()=>{
                                    let action="";
                                    if (rename) action+="rename";
                                    if (schemeChanged){
                                        if (props.current.scheme !== scheme) {
                                            if (action === "") action = "scheme";
                                            else action += ",scheme";
                                        }
                                    }
                                    props.okFunction(action,
                                        {...props.current,name:name,scheme:scheme});
                                }}
                                disabled={!rename && ! schemeChanged}
                            >
                                Change
                            </DB>
                            :
                            null
                        }
                        {allowed.showDelete?
                            <DB name="delete"
                                onClick={()=>{
                                    props.okFunction('delete',props.current.name);
                                }}
                                disabled={changed}
                            >
                                Delete
                            </DB>
                            :
                            null
                        }
                    </DialogButtons>
                    <DialogButtons >
                        {allowed.showImportLog &&
                            <DB name={'log'}
                                onClick={()=>{
                                    OverlayDialog.dialog((dprops)=>{
                                        return <LogDialog {...dprops}
                                                          baseUrl={getImportLogUrl(props.current.name)}
                                                          title={'Import Log'}
                                        />
                                    })
                                }}
                                >Log</DB>
                        }
                        {allowed.showConvertFunction &&
                            <DB name="toroute"
                                onClick={()=>{
                                    props.okFunction('convert',props.current);
                                }}
                                >Convert</DB>
                        }
                        {(allowed.showView )?
                            <DB name="view"
                                onClick={()=>{
                                    props.okFunction('view',props.current);
                                }}
                                disabled={changed}
                            >
                                View
                            </DB>
                            :
                            null}
                        {(allowed.showEdit)?
                            <DB name="edit"
                                onClick={()=>{
                                    props.closeCallback();
                                    props.okFunction('edit',props.current);
                                }}
                                disabled={changed}
                            >
                                Edit
                            </DB>
                            :
                            null
                        }
                        {(allowed.showOverlay)?
                            <DB name="overlays"
                                onClick={()=>{
                                    props.okFunction('overlay',props.current);
                                }}
                                disabled={changed}
                            >
                                Overlays
                            </DB>
                            :
                            null
                        }
                        <ItemDownloadButton
                            name="download"
                            disabled={changed}
                            item={props.current || {}}
                            useDialogButton={true}
                        >
                            Download
                        </ItemDownloadButton>
                        {(allowed.showApp) &&
                        <DB name="userApp"
                            onClick={()=>{
                                props.okFunction('userapp',props.current);
                            }}
                            disabled={changed}
                        >
                            App
                        </DB>

                        }
                        <DB name="cancel"
                        >
                            Cancel
                        </DB>
                    </DialogButtons>
            </DialogFrame>
        );

}
const buildRequestParameters=(request,item,opt_additional)=>{
    return assign({},Helper.filteredAssign(additionalUrlParameters,item),
        opt_additional,
        {
            request: request,
            type: item.type,
            name:item.name
        })
}
export const deleteItem=(info,opt_resultCallback)=> {
    let doneAction=()=> {
        if (opt_resultCallback) opt_resultCallback(info);
    };
    let ok = OverlayDialog.confirm("delete " + info.name + "?");
    ok.then(function () {
        if (info.type === 'layout') {
            LayoutHandler.deleteItem(info.name)
                .then((res)=> {
                    doneAction();
                })
                .catch((err)=>{
                    Toast("unable to delete layout "+info.name+": "+err);
                    doneAction();
                });
            return;
        }
        if (info.type !== "route") {
            Requests.getJson('', {}, buildRequestParameters('delete',info))
                .then(() => {
                    if (info.type === 'track') {
                        NavHandler.resetTrack();
                    }
                    doneAction();
                })
                .catch((error) => {
                    Toast("unable to delete " + info.name + ": " + error);
                    doneAction();
                })
        } else {
            if (RouteHandler.isActiveRoute(info.name)) {
                Toast("unable to delete active route");
                doneAction();
            }
            RouteHandler.deleteRoute(info.name,
                () => {
                    doneAction();
                },
                (rinfo) => {
                    Toast("unable to delete route: " + rinfo);
                    doneAction();
                },
                !info.server //if we think this is a local route - just delete it local only
            );
        }
    });
    ok.catch(function () {
        base.log("delete canceled");
        doneAction();
    });
};

export const showFileDialog=(history,item,opt_doneCallback,opt_checkExists)=>{
    let actionFunction=(action,newItem)=>{
        let doneAction=(pageChanged)=>{
            if (opt_doneCallback){
                opt_doneCallback(action,newItem,pageChanged)
            }
        };
        let schemeAction=(newScheme)=>{
            return Requests.getJson('',{},
                buildRequestParameters('api',item,
                    {command:'scheme',newScheme:newScheme}));
        };
        let renameAction=(name,newName)=>{
            Requests.getJson('',{},
                buildRequestParameters('api',item,
                    {command:'rename',newName:newName}))
                .then(()=>{
                    doneAction();
                })
                .catch((error)=>{
                    Toast("rename failed: "+error);
                    doneAction();
                });
        };
        if (action.match(/scheme/)){
            schemeAction(newItem.scheme)
                .then(()=>{
                    if (action.match(/rename/)) renameAction(item.name,newItem.name);
                    doneAction();
                })
                .catch((error)=>{
                    Toast("change scheme failed: "+error);
                    if (action.match(/rename/)) renameAction(item.name,newItem.name);
                    doneAction();
                });
            return;
        }
        if (action === 'rename'){
            return renameAction(item.name,newItem.name);
        }
        if (action === 'view'){
            doneAction(true);
            history.push('viewpage',{type:item.type,name:item.name,readOnly:true});
            return;
        }
        if (action === 'edit'){
            if (item.type === 'route'){
                RouteHandler.fetchRoute(item.name,!item.server,
                    (route)=>{
                        let editor=new RouteEdit(RouteEdit.MODES.EDIT);
                        editor.setNewRoute(route,0);
                        doneAction(true);
                        history.push('editroutepage',{center:true});
                    },
                    (error)=>{
                        Toast(error);
                        doneAction();
                    });
                return;
            }
            doneAction(true);
            history.push('viewpage',{type:item.type,name:item.name});
            return;
        }
        if (action === 'userapp'){
            if (item.url) {
                showPromiseDialog(undefined, (props) =>
                    <UserAppDialog {...props} fixed={{url: item.url}}/>
                )
                    .then((data) => doneAction())
                    .catch((error) => doneAction());
            }
        }
        if (action === 'delete'){
            return deleteItem(item,()=>doneAction());
        }
        if (action === 'overlay'){
            doneAction();
            if (item.type === 'chart') {
                return EditOverlaysDialog.createDialog(item )
            }
            else{
                OverlayDialog.dialog((props)=>{
                    return(
                        <AddRemoveOverlayDialog
                            {...props}
                            current={item}
                            />
                        )
                });
                return;
            }
        }
        if ( action === 'convert'){
            let convertFunction=showConvertFunctions[newItem.type];
            if (convertFunction){
                convertFunction(history,newItem);
            }
            return;
        }
    };
    OverlayDialog.dialog((props)=>{
        return(
            <FileDialog
                {...props}
                okFunction={actionFunction}
                current={item}
                checkName={opt_checkExists}
            />
        );
    });
};
