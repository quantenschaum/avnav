/**
 * Created by andreas on 23.02.16.
 */

var React=require("react");


var AlarmWidget=React.createClass({
    propTypes:{
        classes: React.PropTypes.string,
        onClick: React.PropTypes.func,
        alarmInfo: React.PropTypes.string
    },
    render: function(){
        var self=this;
        var classes="avn_widget avn_alarmWidget "+this.props.classes||""+ " "+this.props.className||"";
        if (! this.props.alarmInfo) return <div/>;
        return (
        <div className={classes} onClick={this.onClick} style={this.props.style}>
            <div className="avn_widgetInfoLeft">Alarm</div>
            <div>
                <span className="avn_alarmInfo">{this.props.alarmInfo}</span>
            </div>
        </div>
        );
    },
    onClick: function(ev){
        var self=this;
        if (this.props.onClick){
            this.props.onClick();
        }
        ev.stopPropagation();
    }

});

module.exports=AlarmWidget;