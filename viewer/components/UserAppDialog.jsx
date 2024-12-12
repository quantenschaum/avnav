import React, {useEffect, useRef, useState} from 'react';
import PropTypes from 'prop-types';
import OverlayDialog, {DialogRow, SelectList, useDialogContext} from './OverlayDialog.jsx';
import Toast from './Toast.jsx';
import {Checkbox, Input, InputReadOnly, valueMissing} from './Inputs.jsx';
import Addons from './Addons.js';
import Helper from '../util/helper.js';
import Requests from '../util/requests.js';
import UploadHandler from "./UploadHandler";
import {DBCancel, DBOk, DialogButtons, DialogFrame} from "./OverlayDialog";
import {IconDialog} from "./IconDialog";
import globalStore from "../util/globalstore";
import keys from "../util/keys";
import Prism from "prismjs";
import CodeFlask from 'codeflask';

const promiseResolveHelper=({ok,err},resolveFunction,...args)=>{
    let rt=resolveFunction(...args);
    if (rt instanceof Promise){
        rt.then(()=>ok && ok())
            .catch((e)=>{err && err(e)})
        return;
    }
    if (rt) ok && ok();
    else err && err();
}

const ItemNameDialog=({iname,resolveFunction,fixedExt,title,mandatory,checkName})=>{
    const [name,setName]=useState(iname);
    const [error,setError]=useState();
    const dialogContext=useDialogContext();
    const titlevalue=title?title:(iname?"Modify FileName":"Create FileName");
    const completeName=(nn)=>{
        if (! fixedExt) return nn;
        return nn+"."+fixedExt;
    }
    return <DialogFrame className={"itemNameDialog"} title={titlevalue}>
        <Input
            dialogRow={true}
            value={name}
            onChange={(nv)=>{
                setName(nv);
                if (checkName) {
                    setError(checkName(completeName(nv)));
                }
            }}
            mandatory={mandatory}
            checkFunction={(n)=>!checkName(completeName(n))}
            >
            {fixedExt && <span className={"ext"}>.{fixedExt}</span>}
        </Input>
        { error && <DialogRow className={"errorText"}><span className={'inputLabel'}></span>{error}</DialogRow>}
        <DialogButtons buttonList={[
            DBCancel(),
            DBOk(()=> {
                promiseResolveHelper({ok:dialogContext.closeDialog},resolveFunction,completeName(name));
            },{close:false,disabled: valueMissing(mandatory,name) || !!error})
        ]}/>
    </DialogFrame>
};
ItemNameDialog.propTypes={
    iname: PropTypes.oneOfType([PropTypes.string,undefined]),
    resolveFunction: PropTypes.func, //must return true to close the dialog
    checkName: PropTypes.func, //if provided: return an error text if the name is invalid
    title: PropTypes.func, //use this as dialog title
    mandatory: PropTypes.oneOfType([PropTypes.bool,PropTypes.func]), //return true if the value is mandatory but not set
    fixedExt: PropTypes.string //set a fixed extension
}
const EditHtmlDialog=({data,title,resolveFunction,saveFunction})=>{
    const flask=useRef();
    const editElement=useRef();
    const [changed,setChanged]=useState(false);
    const dialogContext=useDialogContext();
    useEffect(() => {
        flask.current = new CodeFlask(editElement.current, {
            language: 'html',
            lineNumbers: true,
            defaultTheme: false,
            noInitialCallback: true,
            highLighter: Prism.highlightElement
        });
        //this.flask.addLanguage(language,Prism.languages[language]);
        flask.current.updateCode(data, true);
        flask.current.onUpdate(()=>setChanged(true));
    }, []);
    return <DialogFrame title={title||"Edit HTML"} className={"editFileDialog"}>
        <div className={"edit"} ref={editElement}></div>
        <DialogButtons buttonList={[
            {
                name: 'save',
                close: false,
                onClick: ()=>{
                    setChanged(false);
                    promiseResolveHelper({err:()=>{setChanged(true)}},saveFunction,flask.current.getCode())
                },
                visible: !!saveFunction,
                disabled: !changed
            },
            DBCancel(),
            DBOk(()=> {
                promiseResolveHelper({ok:dialogContext.closeDialog},resolveFunction,flask.current.getCode());
                },{disabled:!changed,close:false}
            )
        ]}></DialogButtons>
    </DialogFrame>
}

const uploadFromEdit=async (name,data,overwrite)=>{
    try {
        await Requests.postPlain({
            request: 'upload',
            type: 'user',
            name: name,
            overwrite:overwrite
        }, data);
    }catch (e){
        Toast(e);
        throw e;
    }
}

const SelectHtmlDialog=({allowUpload,resolveFunction,current})=>{
    const dialogContext=useDialogContext();
    const [uploadSequence,setUploadSequence]=useState(0);
    const [userFiles,setUserFiles]=useState([]);
    const listFiles=(name)=>{
        Requests.getJson("?request=list&type=user")
            .then((data) => {
                let nuserFiles = [];
                if (data.items) {
                    data.items.forEach((el) => {
                        if (Helper.getExt(el.name) === 'html') {
                            el.label = el.name;
                            el.value = el.url;
                            if (el.url === current) el.selected=true;
                            nuserFiles.push(el);
                            if (name && el.name === name) {
                                resolveFunction(el.url);
                                dialogContext.closeDialog();
                            }
                        }
                    });
                    setUserFiles(nuserFiles)
                }
            }).catch((error) => {
        });
    }
    useEffect(() => {
        listFiles();
    }, []);
    const checkName=(name)=>{
        if (! name) return;
        for (let i=0;i<userFiles.length;i++) {
            if (userFiles[i].name ===name) return "file "+name+" already exists";
        }
    }
    return <DialogFrame title={"Select HTML file"}>
        <UploadHandler
            uploadSequence={uploadSequence}
            type={'user'}
            checkNameCallback={(name)=>{
                if (name && name.substring(name.length-4).toUpperCase() === 'HTML') {
                    let err=checkName(name);
                    if (err) return err;
                    return {name: name}
                }
                return "only files of type html allowed";
            }}
            doneCallback={(v)=>listFiles(v.param.name)}
            errorCallback={(err)=>Toast(err)}
        />
        <SelectList
            list={userFiles}
            onClick={(el)=>{
                dialogContext.closeDialog();
                resolveFunction(el.url);
            }}
        />
        <DialogButtons buttonList={[
            {
                name: 'upload',
                label: 'Upload',
                onClick: ()=>{ setUploadSequence((old)=>old+1)},
                visible: (allowUpload === undefined|| allowUpload) && globalStore.getData(keys.gui.capabilities.uploadUser),
                close: false
            },
            {
                name: 'new',
                label: 'New',
                onClick: () => {
                    dialogContext.showDialog(()=><ItemNameDialog
                        iname={""}
                        fixedExt={"html"}
                        mandatory={(v)=>!v}
                        checkName={checkName}
                        resolveFunction={(name)=>{
                            if (!name) return;
                            const data = `<html>\n<head>\n</head>\n<body>\n<p>Template ${name}</p>\n</body>\n</html>`;
                            dialogContext.showDialog(() => <EditHtmlDialog
                                data={data}
                                resolveFunction={async (modifiedData) => {
                                    await uploadFromEdit(name,modifiedData,true);
                                    listFiles(name);
                                }}
                                saveFunction={async (modifiedData)=>
                                    await uploadFromEdit(name,modifiedData,true)}
                            />)
                        }}/>
                    )
                },
                visible: (allowUpload === undefined|| allowUpload) && globalStore.getData(keys.gui.capabilities.uploadUser),
                close: false
            },
            DBCancel()

        ]}/>
    </DialogFrame>
}

const UserAppDialog = (props) => {
    const [currentAddon, setCurrentAddon] = useState({...props.addon, ...props.fixed});
    const dialogContext = useDialogContext();
    const initiallyLoaded = (props.fixed || {}).url === undefined || props.addon !== undefined;
    const [loaded, setLoaded] = useState(initiallyLoaded);
    const [internal, setInternal] = useState(!(initiallyLoaded && (props.addon || {}).keepUrl));
    const fillLists = () => {
        if (!loaded) Addons.readAddOns()
            .then((addons) => {
                let current = Addons.findAddonByUrl(addons, props.fixed.url)
                if (current) setCurrentAddon({...current, ...props.fixed});
                setLoaded(true);
            })
            .catch((error) => Toast("unable to load addons: " + error));

    }

    useEffect(() => {
        fillLists();
    }, []);
    let fixed = props.fixed || {};
    let canEdit = (currentAddon.canDelete === undefined || currentAddon.canDelete);
    if (!loaded) canEdit = false;
    let fixedUrl = fixed.url !== undefined;
    let title = "";
    if (canEdit) title = fixed.name ? "Modify " : "Create ";
    return (
        <DialogFrame className="userAppDialog" flex={true} title={title + 'User App'}>
            {(fixedUrl || !canEdit) ?
                <InputReadOnly
                    dialogRow={true}
                    className="url"
                    label="url"
                    value={currentAddon.url}/>
                :
                <React.Fragment>
                    {(canEdit && !fixedUrl) && <Checkbox
                        dialogRow={true}
                        label="internal"
                        value={internal}
                        onChange={(nv) => {
                            setInternal(nv);
                            setCurrentAddon({...currentAddon, url: undefined, newWindow: false});
                        }
                        }/>}
                    {!internal ?
                        <Input
                            dialogRow={true}
                            label="external url"
                            value={currentAddon.url}
                            minSize={50}
                            maxSize={100}
                            mandatory={(v) => !v}
                            onChange={(val) => setCurrentAddon({...currentAddon, url: val})}/>
                        :
                        <InputReadOnly
                            dialogRow={true}
                            label="internal url"
                            value={currentAddon.url}
                            mandatory={(v) => !v}
                            onClick={()=>{
                                dialogContext.showDialog(()=>{
                                    return <SelectHtmlDialog
                                        resolveFunction={(url)=>
                                            setCurrentAddon({...currentAddon,url:url})
                                        }
                                        current={currentAddon.url}
                                    />
                                })
                            }}/>
                    }
                </React.Fragment>
            }
            {canEdit ?
                <Input
                    dialogRow={true}
                    label="title"
                    value={currentAddon.title}
                    minSize={50}
                    maxSize={100}
                    onChange={(value) => {
                        setCurrentAddon({...currentAddon, title: value})
                    }}
                />
                :
                <InputReadOnly
                    dialogRow={true}
                    label="title"
                    value={currentAddon.title}
                />
            }
            {(canEdit)?
                <InputReadOnly
                    dialogRow={true}
                    label="icon"
                    value={currentAddon.icon}
                    mandatory={(v) => !v}
                    onClick={()=>{
                        dialogContext.showDialog(()=>{
                            return <IconDialog
                                value={currentAddon.icon}
                                onChange={(icon)=>setCurrentAddon({...currentAddon,icon:icon.url})}
                            />
                        })
                    }}
                >
                    {currentAddon.icon && <img className="appIcon" src={currentAddon.icon}/>}
                </InputReadOnly>
                :
                <InputReadOnly
                    dialogRow={true}
                    label="icon"
                    value={currentAddon.icon}
                >
                    {currentAddon.icon && <img className="appIcon" src={currentAddon.icon}/>}
                </InputReadOnly>
            }
            {canEdit && !internal && <Checkbox
                dialogRow={true}
                label={'newWindow'}
                value={currentAddon.newWindow === 'true'}
                onChange={(nv) => {
                    setCurrentAddon({...currentAddon, newWindow: nv ? 'true' : 'false'});
                }}
            />}


            <DialogButtons buttonList={[
                {
                    name: 'edit',
                    close: false,
                    onClick:async ()=>{
                        const name=currentAddon.url.replace(/.*\//,''); //TODO: really get name from url
                        try {
                            const data = await Requests.getHtmlOrText("", {useNavUrl:true}, {
                                request: 'download',
                                type: 'user',
                                name: name
                            });
                            dialogContext.showDialog(() => <EditHtmlDialog
                                data={data}
                                title={"Edit "+name}
                                saveFunction={async (mData)=> await uploadFromEdit(name,mData,true)}
                                resolveFunction={async (mData)=> await uploadFromEdit(name,mData,true)}
                            />)
                        }catch (e){
                            Toast(e);
                        }
                    },
                    visible: !!currentAddon.url && Helper.startsWith(currentAddon.url,"/user/viewer") && currentAddon.canDelete && canEdit && internal
                },
                {
                    name: 'delete',
                    label: 'Delete',
                    onClick: () => {
                        dialogContext.showDialog(OverlayDialog.createConfirmDialog("really delete User App?",
                            () => {
                                dialogContext.closeDialog();
                                props.removeFunction(currentAddon.name);
                            }
                        ));
                    },
                    close: false,
                    visible: !!(currentAddon.name && currentAddon.canDelete && canEdit)
                },
                DBCancel(),
                DBOk(() => {
                        props.okFunction({...currentAddon, ...props.fixed});
                    },
                    {disabled: !currentAddon.icon || !currentAddon.url || !canEdit})
            ]}/>
        </DialogFrame>
    );
}

UserAppDialog.propTypes = {
    fixed: PropTypes.object.isRequired,
    addon: PropTypes.object,
    closeCallback: PropTypes.func.isRequired,
    okFunction: PropTypes.func.isRequired,
    removeFunction: PropTypes.func.isRequired
};

UserAppDialog.showUserAppDialog = (item, fixed, opt_showToasts) => {
    return new Promise((resolve, reject) => {
        if (!item && !(fixed || {}).url) {
            let err = "either addon or fixed.url required";
            if (opt_showToasts) Toast(err);
            reject(err);
        }
        OverlayDialog.dialog((props) => {
            return (
                <UserAppDialog
                    {...props}
                    okFunction={(addon) => {
                        Addons.updateAddon(addon.name, addon.url, addon.icon, addon.title, addon.newWindow)
                            .then((data) => {
                                resolve(data)
                            })
                            .catch((error) => {
                                if (opt_showToasts) Toast("unable to add/update: " + error);
                                reject(error);
                            });
                    }}
                    removeFunction={(name) => {
                        Addons.removeAddon(name)
                            .then((data) => resolve(data))
                            .catch((error) => {
                                if (opt_showToasts) Toast("unable to remove: " + error);
                                reject(error);
                            });
                    }}
                    //TODO: item vs addon
                    addon={item}
                    fixed={fixed}
                />
            )
        })
    });
};

export default UserAppDialog;