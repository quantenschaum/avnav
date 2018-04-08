/**
 * Created by Andreas on 27.04.2014.
 */

let Page=require('./page.jsx');
let React=require('react');
let ItemUpdater=require('../components/ItemUpdater.jsx');
let navobjects=require('../nav/navobjects');
let Formatter=require('../util/formatter');
let WidgetContainer=require('../components/WidgetContainer');
let WidgetFactory=require('../components/WidgetFactory');

const keys={
  anchorWatch:'anchorWatch', //TODO: should become global
  secondPage: 'second',
  widgetLists: {
      page1:{
          left: 'wlp1left',
          right: 'wlp1right'
      },
      page1a:{
          left: 'wlp1aleft',
          right: 'wlp1aright'
      },
      page2:{
          left: 'wlp2left',
          right: 'wlp2right'
      },
      page2a:{
          left: 'wlp2aleft',
          right: 'wlp2aright'
      }
  }  
    
};


const widgetLists={};
widgetLists[keys.widgetLists.page1.left]=[
    {name:"BRG"},
    {name:"XteDisplay"},
    {name:"DST"},
    {name:"ETA"},
    {name: "RteCombine"}
];

widgetLists[keys.widgetLists.page1.right]=[
    {name:"COG"},
    {name:"SOG"},
    {name:"TimeStatus"},
    {name:"Position"},
    {name:"AisTarget"}
];
widgetLists[keys.widgetLists.page1a.left]=[
    {name:"AnchorBearing"},
    {name:"AnchorDistance"},
    {name:"AnchorWatchDistance"},
    {name: 'Empty'},
    {name: 'Empty'}
];

widgetLists[keys.widgetLists.page1a.right]=[
    {name:"COG"},
    {name:"SOG"},
    {name:"TimeStatus"},
    {name:"Position"},
    {name:"AisTarget"}
];

widgetLists[keys.widgetLists.page2.left]=[
    {name:"BRG"},
    {name:"XteDisplay"},
    {name:"DST"},
    {name:"ETA"},
    {name: "RteCombine"}
];
widgetLists[keys.widgetLists.page2.right]=[
    {name:"COG"},
    {name:"WindGraphics"},
    {name:"SOG"},
    {name:"DepthDisplay"},
    {name:"AisTarget"}
];
widgetLists[keys.widgetLists.page2a.left]=[
    {name:"AnchorBearing"},
    {name:"AnchorDistance"},
    {name:"AnchorWatchDistance"},
    {name: "DepthDisplay"},
    {name: 'Empty'}
];

widgetLists[keys.widgetLists.page2a.right]=[
    {name:"COG"},
    {name:"SOG"},
    {name:"WindAngle"},
    {name:"WindSpeed"},
    {name:"AisTarget"}
];

const layoutBaseParam={
    layoutWidth: 600, //the widgets are prepared for this width, others will scale the font
    layoutHeight: 600,
    baseWeight: 15, //the base weight
    baseWidgetFontSize: 22, //font size for 600x600
};

//the weights for the 2 panels
const weightList=[2*layoutBaseParam.baseWeight,2*layoutBaseParam.baseWeight,
    layoutBaseParam.baseWeight,layoutBaseParam.baseWeight,layoutBaseParam.baseWeight];



/**
 *
 * @constructor
 */
let Gpspage=function(){
    Page.call(this,'gpspage');
    /**
     * @private
     * @type {Formatter}
     */
    this.formatter=new Formatter();
    this.leftPanelHeight=0;
    this.leftPanelWidth=0;
};
avnav.inherits(Gpspage,Page);



Gpspage.prototype.showPage=function(options){
    if (!this.gui) return;
    this.gui.navobject.setAisCenterMode(navobjects.AisCenterMode.GPS);
    this.gui.navobject.getAisHandler().setTrackedTarget(0);
    let secondPage=false;
    if (options && options.secondPage) secondPage=true;
    this.store.storeData(keys.secondPage,secondPage);
    this.handleToggleButton('Gps2',secondPage);
    this.computeLayout();
};


Gpspage.prototype.hidePage=function(){

};

Gpspage.prototype.leftPanelChanged=function(rect){
    this.leftPanelHeight=rect.height;
    this.leftPanelWidth=rect.width;
};

Gpspage.prototype.createElememt=function(key,unit,rel){
    let self=this;
    let Element=function(props){
        return(
            
                <div>
                    <span className='avn_gpsp_value' data-avnrel={rel}>{props[key]}</span>
                    <span className='avn_gpsp_unit'>{unit}</span>
                </div>
        );
    };
    return React.createElement(ItemUpdater(Element,self.gui.navobject,key));
};

Gpspage.prototype.onItemClick=function(item){
  if (item && item.name=== "AisTarget"){
      this.gui.showPage("aisinfopage");
  }
};
Gpspage.prototype.getPageContent=function(){
    let self=this;
    let buttons=[
        {key:'GpsCenter'},
        {key: "Gps2",toggle:true},
        {key: "AnchorWatch",toggle:true},
        {key:'Cancel'}
    ];
    this.setButtons(buttons);
    $(window).on('resize',function(){
        self.computeLayout();
    });
    
    
    $(document).on(navobjects.NavEvent.EVENT_TYPE, function(ev,evdata){
        self.navEvent(evdata);
    });
    let Main=React.createClass({
        goBack: function(){
            self.returnToLast();
        },
        render: function(){
            let widgetCreator=function(widget,list){
                let addClass;
                for (let i=0;i<list.length;i++){
                    if (list[i].name === widget.name){
                        if (i < weightList.length && weightList[i] > layoutBaseParam.baseWeight){
                            addClass="avn_doubleHeight";
                        }
                        break;
                    }
                }
                return WidgetFactory.createWidget(widget,
                    {propertyHandler:self.gui.properties,store: self.store, className:addClass,mode:'gps'});
            };
            //we have based our layout on 1000x600px and now scale the font
            let fw=self.leftPanelWidth/layoutBaseParam.layoutWidth||0;
            let fh=self.leftPanelHeight/layoutBaseParam.layoutHeight||0;
            let fontSize=layoutBaseParam.baseWidgetFontSize;
            if (fw > 0 && fh > 0){
                fontSize=fontSize*Math.min(fh,fw);
            }
            let pageKey='page1';
            if (this.props[keys.secondPage]) pageKey='page2';
            if (this.props[keys.anchorWatch]) pageKey+='a';
            let p1leftProp={
              className: 'avn_gpsLeftContainer',
              itemCreator: (widget)=>{ return widgetCreator(widget,widgetLists[keys.widgetLists[pageKey].left]);},
              itemList: widgetLists[keys.widgetLists[pageKey].left],
              style: { fontSize: fontSize},
              onItemClick: (item) => {self.onItemClick(item);},
              layoutParameter:{
                  direction: 'bottom',
                  scale: true,
                  maxSize: self.leftPanelHeight,
                  weightList: weightList
              }
            };
            let p1RightProp={
                className: 'avn_gpsRightContainer',
                itemCreator: (widget)=>{ return widgetCreator(widget,widgetLists[keys.widgetLists[pageKey].right]);},
                itemList: widgetLists[keys.widgetLists[pageKey].right],
                style: { fontSize: fontSize},
                onItemClick: (item) => {self.onItemClick(item);},
                layoutParameter:{
                    direction: 'bottom',
                    scale: true,
                    maxSize: self.leftPanelHeight,
                    weightList: weightList
                }
            };
            return (
                <div className="avn_panel_fill" onClick={this.goBack}>
                    <div id='avi_gps_page_left' className="avn_gpsp_hfield">
                        <WidgetContainer {...p1leftProp}/>
                    </div>
                    <div id='avi_gps_page_right' className="avn_gpsp_hfield">
                        <WidgetContainer {...p1RightProp}/>
                    </div>
                    {self.getAlarmWidget()}
                </div>
            );
        },
        componentDidMount: function(){
            self.computeLayout();
        },
        componentDidUpdate: function(){
            self.computeLayout();
        }
    });
    return ItemUpdater(Main,this.store,[keys.anchorWatch,keys.secondPage]);
};

/**
 * compute the layout for the page
 * we assum n columns of class avn_gpsp_vfield
 * within each solumn we have n boxes of class avn_gpsp_hfield each having
 *   an attr avnfs given the height weight of this field
 * within eacho of such boxes we assume n avn_gpsp_value floating left each
 * having an attr avnrel given a relative with (nearly character units)
 * @private
 */
Gpspage.prototype.computeLayout=function(){
    let numhfields=0;
    this.getDiv().find('.avn_gpsp_hfield').each(function(i,el){
        numhfields++;
    });
    if (numhfields == 0) return;
    let hfieldw=100/numhfields;
    this.getDiv().find('.avn_gpsp_hfield').each(function(i,el){
        $(el).css('width',hfieldw+"%");
        let vwidth=$(el).width();
        let vheight=$(el).height();
        let numhfields=0;
        let weigthsum=0;
        let vfieldweights=[];
        let vfieldlengths=[];
        $(el).find('.avn_gpsp_vfield').each(function(idx,hel){
            numhfields++;
            vfieldweights[idx]=parseFloat($(hel).attr('data-avnfs'));
            weigthsum+=vfieldweights[idx];
            let len=0;
            $(hel).find('.avn_gpsp_value').each(function(vidx,vel){
                len+=parseFloat($(vel).attr('data-avnrel'));
            });
            vfieldlengths[idx]=len;
        });
        $(el).find('.avn_gpsp_vfield').each(function(idx,hel){
            let relheight=vfieldweights[idx]/weigthsum*100;
            $(hel).css('height',relheight+"%");
            let fontbase=relheight*vheight*0.7/100;
            let labelbase=fontbase;
            let padding=0;
            if ((fontbase * vfieldlengths[idx]) > vwidth ){
                let nfontbase = vwidth/(vfieldlengths[idx]);
                padding=(fontbase-nfontbase)/2;
                fontbase=nfontbase;
            }
            $(hel).find('.avn_gpsp_value').each(function(vidx,vel){
                $(vel).css('font-size',fontbase+"px");
                $(vel).css('padding-top',padding+"px");
            });
            $(hel).find('.avn_gpsp_unit').each(function(vidx,vel){
                $(vel).css('font-size',fontbase*0.3+"px");
            });
            $(hel).find('.avn_gpsp_field_label').each(function(vidx,vel){
                $(vel).css('font-size',labelbase*0.2+"px");
            });
        });

    });
    let xh=$('#avi_gpsp_xte_field').height()-$('#avi_gpsp_xte_label').height();
    try {
        let canvas=document.getElementById('avi_gpsp_xte');
        canvas.height = xh;
        canvas.style.height=xh+"px";
        canvas.width=$('#avi_gpsp_xte').width();
    }catch(e){}

};


Gpspage.prototype.navEvent=function(evt){
    let nearestTarget = this.navobject.getAisHandler().getNearestAisTarget();
    let color="";
    if (this.gui.properties.getProperties().layers.ais && nearestTarget.cpa ){
        let txt="CPA: "+this.navobject.getData('aisCpa')+"nm&nbsp;TCPA: "+this.navobject.getData('aisTcpa');
        $('#avi_gpsp_ais').html(txt);
        color=this.gui.properties.getAisColor({
            nearest: true,
            warning: nearestTarget.warning
        });
    }
    else {
        $('#avi_gpsp_ais').text("");
        color="";
    }
    $('#avi_gpsp_ais_status').css('background-color',color);
    this.store.updateData(keys.anchorWatch,{anchorWatch:!!this.gui.navobject.getRoutingHandler().getAnchorWatch()});

};

//-------------------------- Buttons ----------------------------------------
Gpspage.prototype.btnGpsCenter=function (button,ev){
    avnav.log("Center clicked");
    let pos=this.gui.navobject.getGpsHandler().getGpsData();
    if (pos.valid){
        this.gui.map.setCenter(pos);
    }
    this.returnToLast();
};
Gpspage.prototype.btnGps2=function (button,ev){
    let old=this.store.getData(keys.secondPage,false);
    this.store.storeData(keys.secondPage,!old);
    this.handleToggleButton('Gps2',!old);
};


(function(){
    //create an instance of the status page handler
    let page=new Gpspage();
}());


