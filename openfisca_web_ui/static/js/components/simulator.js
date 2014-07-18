/** @jsx React.DOM */
'use strict';

var find = require('lodash.find'),
  getObjectPath = require('get-object-path'),
  invariant = require('react/lib/invariant'),
  Lazy = require('lazy.js'),
  mapObject = require('map-object'),
  React = require('react/addons'),
  uuid = require('uuid');

var FieldsForm = require('./test-case/form/fields-form'),
  FormWithHeader = require('./form-with-header'),
  IframeVisualization = require('./visualizations/iframe-visualization'),
  JsonVisualization = require('./visualizations/json-visualization'),
  models = require('../models'),
  MoveIndividuForm = require('./test-case/move-individu-form'),
  RattachementEnfantVisualization = require('./visualizations/rattachement-enfant-visualization'),
  revdispDistribution = require('../../data/revdisp-distribution.json'),
  SituateurVisualization = require('./visualizations/situateur-visualization'),
  TestCase = require('./test-case/test-case'),
  TestCaseToolbar = require('./test-case/test-case-toolbar'),
  VisualizationToolbar = require('./visualizations/visualization-toolbar'),
  WaterfallVisualization = require('./visualizations/waterfall-visualization'),
  webservices = require('../webservices');

var appconfig = global.appconfig;


// obj('a', 1, 'b', 2) returns {a: 1, b: 2}
var obj = function() { return Lazy(Array.prototype.slice.call(arguments)).chunk(2).toObject(); };


var Simulator = React.createClass({
  propTypes: {
    columns: React.PropTypes.object,
    columnsTree: React.PropTypes.object,
    legislations: React.PropTypes.array,
    visualizations: React.PropTypes.array,
  },
  componentDidMount: function() {
    window.onresize = this.handleResize;
  },
  componentWillMount: function() {
    webservices.fetchCurrentTestCase(this.currentTestCaseFetched);
    webservices.fetchFields(this.fieldsFetched);
    webservices.fetchLegislations(this.legislationsFetched);
  },
  componentWillUnmount: function() {
    window.onresize = null;
  },
  currentTestCaseFetched: function(data) {
    console.debug('currentTestCaseFetched', data);
    var newState;
    if (data && data.error) {
      console.error(data.error);
      newState = React.addons.update(this.state, {testCase: {$set: null}});
      this.setState(newState);
    } else {
      newState = React.addons.update(this.state, {testCase: {$set: data}});
      this.setState(newState, function() {
        this.repair(data || models.TestCase.getInitialTestCase());
      });
    }
  },
  currentTestCaseSaved: function(data) {
    console.debug('currentTestCaseSaved', data);
  },
  fieldsFetched: function(data) {
    console.debug('fieldsFetched', data);
    if (data) {
      if (data.error) {
        console.error(data.error);
      } else {
        var spec = {
          columns: {$set: data.columns},
          columnsTree: {$set: data.columnsTree},
        };
        var newProps = React.addons.update(this.props, spec);
        this.setProps(newProps);
      }
    }
  },
  getInitialState: function() {
    return {
      editedEntity: null,
      errors: null,
      isSimulationInProgress: false,
      legislationUrl: null,
      movedIndividu: null,
      simulationResult: null,
      suggestions: null,
      testCase: null,
      visualizationSlug: 'cascade',
      waterfallExpandedVariables: {},
      year: appconfig.constants.defaultYear,
    };
  },
  handleCreateEntity: function(kind) {
    console.debug('handleCreateEntity', kind);
    var newEntity = models.TestCase.createEntity(kind, this.state.testCase);
    var newEntities = {};
    newEntities[uuid.v4()] = newEntity;
    var spec = {testCase: {}};
    spec.testCase[kind] = kind in this.state.testCase ? {$merge: newEntities} : {$set: newEntities};
    var newState = React.addons.update(this.state, spec);
    this.setState(newState, function() {
      this.repair();
    });
  },
  handleCreateIndividuInEntity: function(kind, id, role) {
    console.debug('handleCreateIndividuInEntity', arguments);
    var newIndividu = models.TestCase.createIndividu(this.state.testCase);
    var newIndividus = {};
    var newIndividuId = uuid.v4();
    newIndividus[newIndividuId] = newIndividu;
    var spec = {};
    spec.individus = {$merge: newIndividus};
    var newTestCase = React.addons.update(this.state.testCase, spec);
    newTestCase = models.TestCase.withIndividuInEntity(newIndividuId, kind, id, role, newTestCase);
    var newState = React.addons.update(this.state, {testCase: {$set: newTestCase}});
    this.setState(newState, function() {
      this.repair();
    });
  },
  handleDeleteEntity: function(kind, id) {
    console.debug('handleDeleteEntity', arguments);
    var entity = this.state.testCase[kind][id];
    var entityLabel = models.TestCase.getEntityLabel(kind, entity);
    var message = 'Supprimer ' + entityLabel + ' ?'; // jshint ignore:line
    if (confirm(message)) {
      var newTestCase = models.TestCase.withoutEntity(kind, id, this.state.testCase);
      var newState = React.addons.update(this.state, {testCase: {$set: newTestCase}});
      this.setState(newState, function() {
        this.repair();
      });
    }
  },
  handleDeleteIndividu: function(id) {
    console.debug('handleDeleteIndividu', id);
    var message = 'Supprimer ' + this.state.testCase.individus[id].nom_individu + ' ?'; // jshint ignore:line
    if (confirm(message)) {
      var newTestCase = models.TestCase.withoutIndividu(id, this.state.testCase);
      var newState = React.addons.update(this.state, {testCase: {$set: newTestCase}});
      this.setState(newState, function() {
        this.repair();
      });
    }
  },
  handleEditEntity: function(kind, id) {
    console.debug('handleEditEntity', kind, id);
    invariant(this.state.movedIndividu === null, 'movedIndividu exists when requesting edit entity action.');
    if (this.props.columns && this.props.columnsTree) {
      var editedEntity = {id: id, kind: kind};
      var newState = React.addons.update(this.state, {editedEntity: {$set: editedEntity}});
      this.setState(newState);
    } else {
      alert('Impossible de charger les champs du formulaire');
    }
  },
  handleFieldsFormCancel: function() {
    console.debug('handleFieldsFormCancel');
    var newState = React.addons.update(this.state, {editedEntity: {$set: null}});
    this.setState(newState);
  },
  handleFieldsFormChange: function(kind, id, columnName, value) {
    console.debug('handleFieldsFormChange', arguments);
    // Create values empty object in editedEntity if it doesn't exist.
    var state = this.state.editedEntity.values ? this.state :
      React.addons.update(this.state, {editedEntity: {values: {$set: {}}}});
    // Write in this.state.editedEntity.values only values that actually changed. The other stay in this.state.testCase.
    var spec = {editedEntity: {values: {}}};
    spec.editedEntity.values[columnName] = {$set: value};
    var newState = React.addons.update(state, spec);
    this.setState(newState);
  },
  handleFieldsFormSave: function() {
    console.debug('handleFieldsFormSave');
    var spec = {
      editedEntity: {$set: null},
    };
    var id = this.state.editedEntity.id,
      kind = this.state.editedEntity.kind,
      values = this.state.editedEntity.values;
    if (values && Object.keys(values).length) {
      spec.testCase = {};
      spec.testCase[kind] = {};
      spec.testCase[kind][id] = {$merge: values};
    }
    var newState = React.addons.update(this.state, spec);
    this.setState(newState, function() {
      this.repair();
    });
  },
  handleLegislationChange: function(legislationUrl) {
    var newState = React.addons.update(this.state, {legislationUrl: {$set: legislationUrl}});
    this.setState(newState, function() {
      this.simulate();
    });
  },
  handleMoveIndividu: function(id) {
    console.debug('handleMoveIndividu', id);
    invariant(this.state.editedEntity === null, 'editedEntity exists when requesting move individu action.');
    var movedIndividu = Lazy({id: id}).merge(
      Lazy(models.kinds.map(function(kind) {
        return [
          kind,
          Lazy(models.TestCase.findEntityAndRole(id, kind, this.state.testCase)).pick(['id', 'role']).toObject(),
        ];
      }.bind(this))).toObject()
    ).toObject();
    var newState = React.addons.update(this.state, {movedIndividu: {$set: movedIndividu}});
    this.setState(newState);
  },
  handleMoveIndividuFormCancel: function() {
    console.debug('handleMoveIndividuFormCancel');
    var newState = React.addons.update(this.state, {movedIndividu: {$set: null}});
    this.setState(newState);
  },
  handleMoveIndividuFormChange: function(kind, entityId, role) {
    console.debug('handleMoveIndividuFormChange', arguments);
    var newMovedIndividu = Lazy(this.state.movedIndividu).assign(
      obj(kind, {id: entityId, role: role})
    ).toObject();
    this.setState({movedIndividu: newMovedIndividu});
  },
  handleMoveIndividuFormSave: function() {
    console.debug('handleMoveIndividuFormSave');
    var movedIndividuId = this.state.movedIndividu.id;
    var newTestCase = this.state.testCase;
    Lazy(this.state.movedIndividu).omit(['id']).each(function(entityData, kind) {
      if (entityData.id) {
        newTestCase = models.TestCase.moveIndividuInEntity(movedIndividuId, kind, entityData.id, entityData.role,
          newTestCase);
      }
    }.bind(this));
    var changes = {movedIndividu: null, testCase: newTestCase};
    this.setState(changes, function() {
      this.repair();
    });
  },
  handleRepair: function() {
    console.debug('handleRepair');
    this.repair();
  },
  handleReset: function() {
    console.debug('handleReset');
    if (confirm('Réinitialiser la situation ?')) { // jshint ignore:line
      var initialTestCase = models.TestCase.getInitialTestCase();
      this.repair(initialTestCase);
    }
  },
  handleResize: function() {
    this.forceUpdate();
  },
  handleWaterfallVariableToggle: function(variable) {
    console.debug('handleWaterfallVariableToggle', variable);
    var status = this.state.waterfallExpandedVariables[variable.code];
    var newwaterfallExpandedVariables = Lazy(this.state.waterfallExpandedVariables)
      .assign(obj(variable.code, ! status))
      .toObject();
    this.setState({waterfallExpandedVariables: newwaterfallExpandedVariables});
  },
  handleVisualizationChange: function(slug) {
    var newState = React.addons.update(this.state, {visualizationSlug: {$set: slug}});
    this.setState(newState, function() {
      this.simulate();
    });
  },
  handleVisualizationStateChange: function(visualizationState) {
    console.debug('handleVisualizationStateChange', visualizationState);
    var spec = {};
    spec[this.state.visualizationSlug] = {$set: visualizationState};
    var newState = React.addons.update(this.state, spec);
    this.setState(newState);
  },
  handleYearChange: function(year) {
    console.debug('handleYearChange', year);
    var newState = React.addons.update(this.state, {year: {$set: year}});
    this.setState(newState, function() {
      this.simulate();
    });
  },
  legislationsFetched: function(data) {
    console.debug('legislationsFetched', data);
    if (data) {
      if (data.error) {
        console.error(data.error);
      } else if (data.length) {
        var newProps = React.addons.update(this.props, {legislations: {$set: data}});
        this.setProps(newProps);
        var newState = React.addons.update(this.state, {legislationSlug: {$set: data[0].slug}});
        this.setState(newState);
      }
    }
  },
  render: function() {
    var rightPanel;
    if (this.state.editedEntity) {
      rightPanel = this.renderFieldsFormPanel();
    } else if (this.state.movedIndividu) {
      var movedIndividuId = this.state.movedIndividu.id;
      var selectedByKind = Lazy(this.state.movedIndividu).omit(['id']).toObject();
      var currentEntityIdByKind = Lazy(models.kinds.map(function(kind) {
        var entityData = models.TestCase.findEntityAndRole(movedIndividuId, kind, this.state.testCase);
        if (entityData) {
          return [
            kind,
            Lazy(entityData).get('id'),
          ];
        }
      }.bind(this))).compact().toObject();
      rightPanel = (
        <FormWithHeader
          onCancel={this.handleMoveIndividuFormCancel}
          onSave={this.handleMoveIndividuFormSave}
          title={
            'Déplacer ' + this.state.testCase.individus[movedIndividuId].nom_individu /* jshint ignore:line */
          }>
          <MoveIndividuForm
            currentEntityIdByKind={currentEntityIdByKind}
            entitiesMetadata={models.entitiesMetadata}
            getEntityLabel={models.TestCase.getEntityLabel}
            onChange={this.handleMoveIndividuFormChange}
            roleLabels={models.roleLabels}
            selectedByKind={selectedByKind}
            testCase={this.state.testCase}
          />
        </FormWithHeader>
      );
    } else {
      rightPanel = this.renderVisualizationPanel();
    }
    return (
      <div className="row">
        <div className="col-sm-4">
          <TestCaseToolbar
            disabled={ !! this.state.editedEntity || !! this.state.movedIndividu}
            hasErrors={ !! this.state.errors}
            isSimulationInProgress={this.state.isSimulationInProgress}
            onCreateEntity={this.handleCreateEntity}
            onReset={this.handleReset}
            onRepair={this.handleRepair}
            onSimulate={this.simulate}
          />
          <hr/>
          {
            this.state.testCase &&
            <TestCase
              entitiesMetadata={models.entitiesMetadata}
              errors={this.state.errors}
              frozenEntity={this.state.editedEntity || this.state.movedIndividu}
              getEntityLabel={models.TestCase.getEntityLabel}
              onCreateIndividuInEntity={this.handleCreateIndividuInEntity}
              onDeleteEntity={this.handleDeleteEntity}
              onDeleteIndividu={this.handleDeleteIndividu}
              onEditEntity={this.handleEditEntity}
              onMoveIndividu={this.handleMoveIndividu}
              roleLabels={models.roleLabels}
              suggestions={this.state.suggestions}
              testCase={this.state.testCase}
            />
          }
        </div>
        <div className="col-sm-8" ref='rightPanel'>
          {rightPanel}
        </div>
      </div>
    );
  },
  renderFieldsFormPanel: function() {
    var id = this.state.editedEntity.id,
      kind = this.state.editedEntity.kind;
    var entity = this.state.testCase[kind][id];
    var title = kind === 'individus' ?
      entity.nom_individu : // jshint ignore:line
      models.TestCase.getEntityLabel(kind, entity);
    invariant('children' in this.props.columnsTree[kind], 'columnsTree.' + kind + ' has no children');
    var categories = mapObject(this.props.columnsTree[kind].children, function(category) {
      return {
        columns: category.children ? category.children.map(function(columnName) {
          invariant(columnName in this.props.columns, 'column "' + columnName + '" is not in columns prop');
          return this.props.columns[columnName];
        }, this) : null,
        label: category.label,
      };
    }, this);
    var errors = getObjectPath(this.state.errors, kind + '.' + id);
    var suggestions = getObjectPath(this.state.suggestions, kind + '.' + id);
    var values = this.state.testCase[kind][id];
    if (this.state.editedEntity.values) {
      values = React.addons.update(values, {$merge: this.state.editedEntity.values});
    }
    return (
      <FormWithHeader
        onCancel={this.handleFieldsFormCancel}
        onSave={this.handleFieldsFormSave}
        title={'Éditer ' + title}>
        <FieldsForm
          categories={categories}
          errors={errors}
          onChange={this.handleFieldsFormChange.bind(null, kind, id)}
          suggestions={suggestions}
          values={values}
        />
      </FormWithHeader>
    );
  },
  renderVisualization: function() {
    invariant(this.state.simulationResult, 'this.state.simulationResult is empty');
    var rightPanelNode = this.refs.rightPanel.getDOMNode();
    var rightPanelWidth = rightPanelNode.clientWidth;
    var visualizationHeight = rightPanelWidth * 0.66;
    if (this.state.simulationResult.error) {
      return (
        <p className="text-danger">
          Erreur de simulation sur le serveur, veuillez nous excuser.
          L'équipe technique vient d'être prévenue par un email automatique.
        </p>
      );
    } else {
      if (this.state.visualizationSlug === 'json') {
        return <JsonVisualization data={this.state.simulationResult} />;
      } else if (this.state.visualizationSlug === 'rattachement-enfant') {
        var simulationResult = this.state.simulationResult && ! this.state.simulationResult.errors &&
          this.state.simulationResult.values[0];
        return (
          <RattachementEnfantVisualization
            legislationUrl={this.state.legislationUrl}
            localState={this.state[this.state.visualizationSlug]}
            onChange={this.handleVisualizationStateChange}
            onSimulate={this.simulate}
            simulationResult={simulationResult}
            testCase={this.state.testCase}
            year={this.state.year}
          />
        );
      } else if (this.state.visualizationSlug === 'situateur') {
        var value = this.state.simulationResult.values[0];
        return (
          <SituateurVisualization
            height={visualizationHeight}
            points={revdispDistribution}
            value={value}
            width={rightPanelWidth}
            xSnapIntervalValue={5}
            yMaxValue={Math.max(100000, value)}
          />
        );
      } else if (this.state.visualizationSlug === 'cascade') {
        return (
          <WaterfallVisualization
            expandedVariables={this.state.waterfallExpandedVariables}
            height={visualizationHeight}
            onVariableToggle={this.handleWaterfallVariableToggle}
            variablesTree={this.state.simulationResult}
            width={rightPanelWidth}
          />
        );
      } else if ( ! this.props.visualizations) {
        return <p className="text-danger">Aucune visualisation disponible.</p>;
      } else {
        var visualization = find(this.props.visualizations, {slug: this.state.visualizationSlug});
        invariant(visualization, 'selected visualization not found in vizualisations prop');
        invariant(visualization.iframeSrcUrl, 'selected visualization has no iframeSrcUrl');
        return <IframeVisualization
          height={visualizationHeight}
          legislationUrl={this.state.legislationUrl}
          testCaseUrl={visualization.testCaseUrl}
          url={visualization.iframeSrcUrl}
          width={rightPanelWidth}
          year={this.state.year}
        />;
      }
    }
  },
  renderVisualizationPanel: function() {
    return (
      <div>
        <VisualizationToolbar
          legislation={this.state.legislationUrl}
          legislations={this.props.legislations}
          onLegislationChange={this.handleLegislationChange}
          onVisualizationChange={this.handleVisualizationChange}
          onYearChange={this.handleYearChange}
          visualizations={this.props.visualizations}
          visualizationSlug={this.state.visualizationSlug}
          year={this.state.year}
        />
        <hr/>
        {
          this.state.simulationResult ? this.renderVisualization() : (
            this.state.errors && <p>Erreurs dans le formulaire</p>
          )
        }
      </div>
    );
  },
  repair: function(testCase) {
    console.debug('repair', testCase);
    webservices.repair(testCase || this.state.testCase, this.state.year, this.repairCompleted);
  },
  repairCompleted: function(data) {
    console.debug('repairCompleted', data);
    var errors = data.errors,
      originalTestCase = data.originalTestCase,
      suggestions = data.suggestions,
      testCase = data.testCase;
    var spec = {
      errors: {$set: errors},
      suggestions: {$set: suggestions},
    };
    if (errors) {
      spec.simulationResult = {$set: null};
      if (originalTestCase) {
        webservices.saveCurrentTestCase(originalTestCase, this.currentTestCaseSaved);
      }
    } else if (testCase) {
      var newTestCase = models.TestCase.withEntitiesNamesFilled(testCase);
      spec.testCase = {$set: newTestCase};
      webservices.saveCurrentTestCase(newTestCase, this.currentTestCaseSaved);
    }
    var newState = React.addons.update(this.state, spec);
    this.setState(newState, function() {
      if ( ! this.state.errors) {
        this.simulate();
      }
    });
  },
  simulate: function(legislationUrl, testCase, year) {
    console.debug('simulate', legislationUrl, testCase, year);
    if ( ! this.state.isSimulationInProgress && ! this.state.errors) {
      var newState = React.addons.update(this.state, {isSimulationInProgress: {$set: true}});
      this.setState(newState, function() {
        webservices.simulate(legislationUrl || this.state.legislationUrl, testCase || this.state.testCase,
          year || this.state.year, this.simulationCompleted);
      });
    }
  },
  simulationCompleted: function(data) {
    console.debug('simulationCompleted', data);
    var spec = {
      isSimulationInProgress: {$set: false},
    };
    if (data) {
      if (data.error) {
        console.error(data.error);
        spec.simulationResult = {$set: {error: data.error}};
      } else {
        spec.errors = {$set: data.errors ? data.errors : null};
        spec.simulationResult = {$set: data};
      }
    }
    var newState = React.addons.update(this.state, spec);
    this.setState(newState);
  },
  visualizationsFetched: function(data) {
    console.debug('visualizationsFetched', data);
    if (data) {
      if (data.error) {
        console.error(data.error);
      } else {
        if (data.length) {
          var newProps = React.addons.update(this.props, {visualizations: {$set: data}});
          this.setProps(newProps);
        }
        var spec = {visualizationSlug: {$set: data.length ? data[0].slug : 'json'}};
        var newState = React.addons.update(this.state, spec);
        this.setState(newState);
      }
    }
  },
});

module.exports = Simulator;