/** @jsx React.DOM */
'use strict';

var React = require('react/addons');

var cx = React.addons.classSet;


var Entity = React.createClass({
  propTypes: {
    active: React.PropTypes.bool,
    hasErrors: React.PropTypes.bool,
    label: React.PropTypes.string.isRequired,
    onDelete: React.PropTypes.func.isRequired,
    onEdit: React.PropTypes.func.isRequired,
  },
  preventDefaultThen: function(callback, event) {
    event.preventDefault();
    callback();
  },
  render: function() {
    return (
      <div className={cx('panel', this.props.hasErrors ? 'panel-danger' : 'panel-default')}>
        <div className="panel-heading">
          <div className="btn-group">
            <button
              className={cx('btn', 'btn-default', 'btn-sm', this.props.active && 'active')}
              onClick={this.props.onEdit}
              type="button">
              {this.props.label}
            </button>
            <button
              className={cx('btn', 'btn-default', 'btn-sm', 'dropdown-toggle')}
              data-toggle="dropdown"
              type="button">
              <span className="caret"></span>
              <span className="sr-only">Toggle Dropdown</span>
            </button>
            <ul className="dropdown-menu" role="menu">
              <li>
                <a
                  href="#"
                  onClick={this.preventDefaultThen.bind(null, this.props.onEdit)}>
                  Éditer
                </a>
                <a
                  href="#"
                  onClick={this.preventDefaultThen.bind(null, this.props.onDelete)}>
                  Supprimer
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="list-group">
          {this.props.children}
        </div>
      </div>
    );
  },
});

module.exports = Entity;
