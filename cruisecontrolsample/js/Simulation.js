//global variables
var _ws;
var _servletPath;

var _updateValue = "updateValue";
var _updateWidgetValue = "updateWidgetValue";
var _updateExecutionStatus = "updateExecutionStatus";
var _updateImageSwitcher = "updateImageSwitcher";
var _updateVerificationStatus = "updateVerificationStatus";
var _valueChanged = "valueChanged";
var _widgetValueChanged = "widgetValueChanged";
var _getWidgetPath = "getWidgetPath";
var _elementActivated = "elementActivated";
var _annotationsUpdated = "annotationsUpdated";
var _verificationStatusChanged = "verificationStatusChanged";
var _executionStatusChanged = "executionStatusChanged";
var _reloadPage = "reloadPage";
var _replacePage = "replacePage";
var _assignPage = "assignPage";
// plots
var _createTimeSeries = "createTimeSeries";
var _timeSeriesValueChanged = "timeSeriesValueChanged";
var _timeSeriesAdded = "timeSeriesAdded";
var _createTimeline = "createTimeline";
var _timelineValueChanged = "timelineValueChanged";
var _timelineAnnotationsAdded = "timelineAnnotationsAdded";
var _getPlotImage = "getPlotImage";
let _dirtyPlots = new Set();
let _plotUpdater = null;
let _plotUpdaterInterval = 100;
let controlPanelDragged = false;

var _default_opacity = 0.3;
const hoverFormat = '.4~f';

$(document).ready(function() {
	//Fix SIM-7397
	$.ajaxSetup({ cache: false });
	loadInlineSVG();
	connectToSimulationWebSocket();
	dispatchContentEditableOnChange();
	lostFocusWhenEnterPressed();
	displayControlPanelOnMouseOver();
	hideControlPanel();
});

function displayControlPanelOnMouseOver() {
	$(document).hover(showControlPanel, hideControlPanel);
	// need this because hover not working if mouse is inside frame on page load
	$(document).one('mousemove', showControlPanel);
}

function showControlPanel() {
	$('#SimulationControlPanel').css('visibility', 'visible')
}

function hideControlPanel() {
	$('#SimulationControlPanel').css('visibility', 'hidden');
}

function connectToSimulationWebSocket() {
	if ('WebSocket' in window) {
		// alert('WebSocket is supported. You can proceed with your code');
	} else {
		// alert('WebSockets are not supported. Try a fallback method like long-polling etc');
		alert('WebSockets are not supported.');
	}
	// simulation web server is started.
	var wsPath = "simulationWS";
	_servletPath = "/" + wsPath;

	//ws://@IP_ADDRESS@:@PORT@/wsPath
	_ws = new WebSocket("ws://" + $(location).attr('host') + "/" + wsPath);

	_ws.onopen = function() {
		registerExecutionStatus();
		registerNestedPaths();
		registerWidgets();
		registerImageSwitcher();
		registerPlot();
		loadNestedWidgets();
	};

	_ws.onerror = function(error) {
		console.log(error);
	};

	_ws.onmessage = function(event) {
		processServerResponse(event);
	};

	_ws.onclose = function() {
		console.log('web socket connection is closed.');
		disableSimulationControlPanelButtons();
	};
}

function processServerResponse(event)
{
	const type = getType(event);
	if (type === 'object' && event.data !== undefined)
	{
		try
		{
			const jsonData = JSON.parse(event.data);
			const method = jsonData.method;
			switch (method)
			{
				case _valueChanged:
				{
					let paths = jsonData.paths;
					let val = jsonData.value;
					if (isString(paths) && val !== undefined)
					{
						$("[runtime=true]").each(function (index, item) {
							if ($(this).attr('paths') === paths)
							{
								setHTMLValue(item, val, jsonData.formattedValue);
							}
						});
					}
					break;
				}
				case _widgetValueChanged:
				{
					let paths = jsonData.paths;
					let val = jsonData.value;
					if (isString(paths) && val != null)
					{
						var selector = ".widget[paths='" + jsonData.parentPaths + "']";
						$(selector).each(function (parentIndex, parentItem) {
							$(parentItem).find("[runtime=true][pathType=widget]").each(function (index, item) {
								if ($(item).attr('paths') === paths)
								{
									setHTMLValue(item, val, jsonData.formattedValue);
								}
							});
						});
					}
					break;
				}
				case _timeSeriesValueChanged:
					plotTimeSeries(jsonData);
					break;
				case _timeSeriesAdded:
					addTimeSeries(jsonData);
					break;
				case _createTimeSeries:
					createTimeSeriesPlot(jsonData);
					break;
				case _createTimeline:
					createTimeline(jsonData);
					break;
				case _timelineValueChanged:
					plotTimeline(jsonData);
					break;
				case _timelineAnnotationsAdded:
					addTimelineAnnotations(jsonData);
					break;
				case _elementActivated:
				{
					let represents = jsonData.represents;
					if (represents !== undefined)
					{
						switchImage(jsonData.id, jsonData.paths, represents, jsonData.parentRepresents);
					}
					break;
				}
				case _annotationsUpdated:
					updateAnnotations(jsonData.removedAnnotations, jsonData.addedAnnotations);
					break;
				case _verificationStatusChanged:
				{
					let paths = jsonData.paths;
					if (paths !== undefined)
					{
						changeComponentProperties(paths, jsonData.foregroundColor, jsonData.backgroundColor, jsonData.tooltipText);
					}
					break;
				}
				case  _executionStatusChanged:
					let executionStatus = jsonData.executionStatus;
					if (executionStatus !== undefined)
					{
						doUpdateExecutionStatus(executionStatus)
					}
					break;
				case _updateExecutionStatus:
					updateExecutionStatus();
					break;
				case _updateValue:
				{
					let pathType = jsonData.pathType;
					let paths = jsonData.paths;
					let value = jsonData.value;
					if (pathType !== undefined && paths !== undefined && value !== undefined)
					{
						updateValue(pathType, paths, value, jsonData.formattedValue);
					}
					break;
				}
				case _updateWidgetValue:
				{
					let pathType = jsonData.pathType;
					let paths = jsonData.paths;
					let value = jsonData.value;
					if (pathType !== undefined && paths !== undefined && value !== undefined)
					{
						updateWidgetValue(pathType, jsonData.parentPaths, paths, value, jsonData.formattedValue);
					}
					break;
				}
				case _updateImageSwitcher:
				{
					let id = jsonData.id;
					let represents = jsonData.represents;
					if (id !== undefined && represents !== undefined)
					{
						updateImageSwitcher(id, jsonData.paths, represents, jsonData.parentRepresents);
					}
					break;
				}
				case _updateVerificationStatus:
				{
					let pathType = jsonData.pathType;
					let paths = jsonData.paths;
					let componentType = jsonData.componentType;
					if (pathType !== undefined && paths !== undefined && componentType !== undefined)
					{
						updateVerificationStatus(pathType, paths, componentType, event.data);
					}
					break;
				}
				case _getPlotImage:
				{
					let divID = jsonData.divID;
					if (divID !== undefined)
					{
						sendPlotImage(divID)
					}
					break;
				}
				case  _reloadPage:
					location.reload();
					break;
				case  _replacePage:
				{
					let url = jsonData.url;
					if (url !== undefined)
					{
						location.replace(url);
					}
					break;
				}
				case _assignPage:
				{
					let url = jsonData.url;
					if (url !== undefined)
					{
						location.assign(url);
					}
					break;
				}
			}
		}
		catch (err)
		{
			console.log("Process Server Response:" + err.message);
			console.log("Process Server Response:" + err.stack);
		}
	}
}

function runConfig(configID) {
	var json = {
		"method" : "runConfig",
		"configID" : configID
	};
	sendMessage(JSON.stringify(json));
}

function toProject(projectID) {
	var json = {
		"method" : "toProject",
		"projectID" : projectID
	};
	sendMessage(JSON.stringify(json));
}

function setValue(component) {
	var set = customSetValue(component);
	if (!set) {
	var represents = findRepresents(component);
	var parentRepresents = findParentRepresents(component);
	if (getHTMLType(component) == "textfield" || getHTMLType(component) == "range" || getHTMLType(component) == "radio" || getHTMLType(component) == "select") {
		doSetValue($(component).attr('pathType'), $(component).attr('paths'), represents, parentRepresents, $(component).val());
	} else if (getHTMLType(component) == "checkbox") {
		doSetValue($(component).attr('pathType'), $(component).attr('paths'), represents, parentRepresents, $(component).prop('checked'))
	} else if (getHTMLType(component) == "td") {
		doSetValue($(component).attr('pathType'), $(component).attr('paths'), represents, parentRepresents, $(component).html())
		}
	}
}

function doSetValue(pathType, paths, represents, parentRepresents, value) {
	$.get(_servletPath, { method : "setValue", pathType : pathType, paths : paths, represents : represents, parentRepresents : parentRepresents, value : value });
}

function customSetValue(component) {
	return false; 	// is redeclared in some widget htmls to extend functionality
}

function doSetWidgetValue(component, value) {
	var pathType = $(component).attr('pathType');
	var parentPaths = findParentWidgetPaths(component);
	var paths = $(component).attr('paths');
	var parentRepresents = $(component).parent().closest(".widget").attr("parentRepresents");
	$.get(_servletPath, { method : "setValue", pathType : pathType, parentPaths : parentPaths, paths : paths, parentRepresents : parentRepresents, value : value });
}

function wrap(component, formattedValue) {
	if (formattedValue !== undefined) {
		//get actual value
		var actualValue = getComponentValue(component);
		if (actualValue != null) {
			//backup
			$(component).attr("actualValue", actualValue);
			$(component).attr("formattedValue", formattedValue);

			var newValue = formattedValue;
			if (getHTMLType(component) == "textfield") {
				$(component).val(newValue);
			} else if (getHTMLType(component) == "td" || getHTMLType(component) == "label") {
				$(component).html(newValue);
			}
		}
	}
}

function componentFocusLost(component) {
	if (getHTMLType(component) == "textfield") {
		if ($(component).val() != component.editing_text) {
			setValue(component);
		}
		delete component.editing_text;
	}
}

function componentFocusGained(component) {
	if (getHTMLType(component) == "textfield") {
		component.editing_text = $(component).val();
	}
}

function validateTypeForTextField(component, validType) {
	if (getHTMLType(component) == "textfield") {
		v = $(component).val();
		checkType = true;
		activeE = document.activeElement;
		if (v.length > 0 && activeE != component) {
			if (validType == 'integer')
			{
				validType = 'number';
				vInt = parseInt(v);
				if (!isNaN(vInt))
				{
					v = vInt;
					$(component).val(v);
					checkType = false;
				}
			}
			if (checkType)
			{
				if ((validType == 'number' && (!isFinite(v) || v.trim() === '')) || (validType == 'boolean' && v.toLowerCase() != 'false' && v.toLowerCase() != 'true')) {
					alert("IIIegal value, '" + v + "' is not a " + validType + ".");
					setTimeout(function () {
						actElement = document.activeElement;
						if (typeof(actElement) != 'undefined' && actElement.nodeName == "INPUT") {
							document.activeElement.focus();
						}
					}, 100);
				}
			}
		}
	}
}

function getComponentValue(component) {
	if (getHTMLType(component) == "textfield") {
		return $(component).val();
	} else if (getHTMLType(component) == "td" || getHTMLType(component) == "label") {
		return $(component).html();
	}
	return null;
}

function sendSignal(component, signal, signalID) {
	sendSignal(component, signal, signalID, null);
}

function sendSignal(component, signal, signalID, values) {
	var json = {
		"values" : values
	}
	$.get(_servletPath, { method : "sendSignal", pathType : $(component).attr('pathType'), paths : $(component).attr('paths'), represents : findRepresents($(component)), parentRepresents : findParentRepresents($(component)), signal : signal, signalID : signalID, values : JSON.stringify(json)} );
}

function findRepresents(component) {
	return $(component).closest("*[represents]").attr("represents");
}

function findParentRepresents(component) {
	return $(component).parent().closest("*[represents]").attr("represents");
}

function findParentWidgetPaths(component) {
	return $(component).parent().closest(".widget").attr("paths");
}

//register both nested names and IDs
function registerNestedPaths() {
	registerNestedNames();
}

function registerNestedNames() {
	$("[runtime=true][pathType=name]").each(function(index, item) {
		doRegisterNestedNames($(this));
	});
}

function registerNestedName(component) {
	doRegisterNestedNames(component);
}

function registerWidgets() {
	$(".widget").each(function(index, item) {
		doRegisterWidgets($(this));
	});
}

function doRegisterWidgets(component) {
	var parentPaths = $(component).attr('paths');
	var parentRepresents = $(component).attr('parentRepresents');

	if (parentRepresents == undefined || parentRepresents == "")
	{
		parent.$("iframe").each(function(index, item) {
			if (item.contentWindow == window)
			{
				parentRepresents = $(item).attr('parentRepresents');
			}
		});
	}

	//find all runtime elements under widget.
	$(component).find("[runtime=true][pathType=widget]").each(function(index, item) {
		var json = {
			"method" : "registerWidgetPaths",
			"pathType" : "widget",
			"paths" : $(item).attr('paths'),
			"parentPaths" : parentPaths,
			"parentRepresents" : parentRepresents
		};
		sendMessage(JSON.stringify(json));
	});
}

//registers nested names via ws.
function doRegisterNestedNames(component) {
	var paths = $(component).attr('paths');
	var componentType = getHTMLType(component);
	var represents = findRepresents(component);
	var parentRepresents = findParentRepresents(component);
	var json = {
		"method" : "registerPaths",
		"pathType" : "name",
		"paths" : paths,
		"represents" : represents,
		"parentRepresents" : parentRepresents,
		"componentType" : componentType
	};
	sendMessage(JSON.stringify(json));
}

function registerPlot() {
	$("div[id][configID]").each(function(index, item) {
		doRegisterPlot($(this));
	});
}

//registers plot via ws.
function doRegisterPlot(component) {
	var divID = $(component).attr('id');
	var paths = $(component).attr('paths');
	var configID = $(component).attr('configID');
	var represents = findRepresents($(component));
	var parentRepresents = findParentRepresents($(component));
	var json = {
		"method" : "registerPlot",
		"divID" : divID,
		"paths" : paths,
		"represents" : represents,
		"parentRepresents" : parentRepresents,
		"configID" : configID
	};
	sendMessage(JSON.stringify(json));
}

function createAnnotation(annotation)
{
	return {
		x: annotation.x,
		y: annotation.y,
		yref: 'y' + annotation.yAxisReference,
		text: annotation.text,
		showarrow: false
	};
}

function constructStateTimelineData(jsonData)
{
	let data = [];
	const xValues = jsonData.x;
	const yValues = jsonData.y;
	const line = {shape: 'hv', color: jsonData.color};
	const yAxisNumbers = jsonData.yAxisNumbers
	for (let i = 0; i < xValues.length; i++)
	{
		data[i] = {
			x: xValues[i],
			y: yValues[i],
			yaxis: 'y' + yAxisNumbers[i],
			type: 'scatter',
			mode: 'lines+text',
			line: line
		}
	}
	return data;
}

function constructActivityTimelineData(jsonData)
{
	let data = [];
	const xValues = jsonData.x;
	const yValues = jsonData.y;

	const lineStyle = {color: jsonData.color};
	const markerStyle = {symbol: "line-ns-open", color: jsonData.color, line: {width: 2},size: 12};

	const yAxisNumbers = jsonData.yAxisNumbers;
	let length = xValues.length;
	for (let i = 0; i < length; i++)
	{
		let yAxisName = 'y' + yAxisNumbers[i];
		let xValuesAt = xValues[i];
		let yValuesAt = yValues[i];
		data[i] = {
			x: xValuesAt,
			y: yValuesAt,
			yaxis: yAxisName,
			line: lineStyle,
			mode : 'lines'
		}
		// vertical markers - either left only for ongoing executions, or on both ends for ended executions
		// cannot put markers in the same data as lines above, because it would always place marker at every value, even though activity has not ended yet
		data[length+i] = constructLaneMarkers(xValuesAt, yValuesAt, yAxisName, markerStyle);
	}
	return data;
}

function constructLaneMarkers(xValuesAt, yValuesAt, yAxisName, markerStyle)
{
	const markersX = [];
	const markersY = [];
	let length = yValuesAt.length;
	for (let m = 0; m < length; m++)
	{
		let yVal = yValuesAt[m];
		if (yVal != null)
		{
			if ((m === 0 || yValuesAt[m-1] === null) // activity start
				|| (m < length - 1 && yValuesAt[m+1] === null)) // activity end
			{
				markersX.push(xValuesAt[m]);
				markersY.push(yValuesAt[m]);
			}
		}
	}

	return {
		x: markersX,
		y: markersY,
		yaxis: yAxisName,
		marker: markerStyle,
		mode : 'markers'
	}
}

function getUpdatedTimeAxisRange(jsonData, l)
{
	let lowerBound = jsonData.timeAxisLowerBound;
	let upperBound = jsonData.timeAxisUpperBound;
	if (lowerBound != null && upperBound != null)
	{
		let oldRange = l.xaxis.range;
		if (oldRange == null || (lowerBound > oldRange[0] || upperBound > oldRange[1]))
		{
			return [lowerBound, upperBound];
		}
	}
	return null;
}

function constructTimelineLayout(jsonData, chart)
{
	let layout = {
		title: jsonData.title,
		xaxis: {
			title: jsonData.timeAxisTitle,
			automargin: true,
			hoverformat: hoverFormat,
			nticks: 40,
			rangemode: 'nonnegative'
		},
		margin: {
			t: 30,
			b: 34
		},
		showlegend: false,
		hovermode: 'closest',
		hoverlabel: {
			namelength: 0
		}
	}
	let range = getUpdatedTimeAxisRange(jsonData, layout);
	if (range != null)
	{
		layout.xaxis.range = range;
	}
	let timeAxisTickStep = jsonData.timeAxisTickStep;
	if (timeAxisTickStep != null)
	{
		layout.xaxis.dtick = timeAxisTickStep;
	}
	let totalHeight = 0;   // for plot height calculation
	let lastDomainEnd = 1; // to avoid gaps in domain due to rounding errors
	for (const y of jsonData.yAxes)
	{
		let catArray = y.categoryArray;
		totalHeight += y.height;
		let domainStart = Math.round(y.domainStart * 100 + Number.EPSILON ) / 100;
		layout[y.identifier] = {
			title: y.title,
			type: 'category',
			categoryorder : 'array',
			categoryarray : catArray,
			automargin: true,
			ticksuffix : ' ', // cosmetic padding
			range: [-0.3, catArray.length], // leave space below 0 value for text annotation
			domain: [domainStart, lastDomainEnd]
		}
		lastDomainEnd = domainStart;
	}
	if ($(chart).parent().is("body")) // when embedded in another node, height should always match the height of parent node SIM-17660
	{
		// 450 is default height for plotly (when no height is provided), so only increase the height
		layout.height = Math.max(450, totalHeight + 60);
	}
	const textAnnotations = [];
	for (const annotation of jsonData.annotations)
	{
		textAnnotations.push(createAnnotation(annotation))
	}
	layout.annotations = textAnnotations;
	return layout;
}

function createTimeline(jsonData)
{
	let data;
	if (jsonData.mode === "state")
	{
		data = constructStateTimelineData(jsonData);
	}
	else
	{
		data = constructActivityTimelineData(jsonData);
	}
	let divID = jsonData.divID;
	let chart = document.getElementById(divID);
	const layout = constructTimelineLayout(jsonData, chart);
	Plotly.newPlot(chart, data, layout, {responsive: true});
	onPlotCreated();
}

function optimizeTimelineData(newValue, data)
{
	if (newValue != null) // do not remove when region exits instead of changing the state
	{
		const yLength = data.y.length;
		if (yLength > 1 && data.y[yLength - 1] === data.y[yLength - 2]) // when value did not change...
		{
			// ...then optimize data structure, only need to keep
			//  	-  (state) when state starts and changes
			//		-  (activity) when activity starts and ends
			data.x.pop();
			data.y.pop();
		}
	}
}

function addTimelineValue(x, newValue, data)
{
	optimizeTimelineData(newValue, data);
	data.x.push(x);
	data.y.push(newValue);
}

function updateValueForActivityTimeline(x, newValue, data, markersData)
{
	const yLength = data.y.length;
	let lastValue = null;
	let shouldAdd = newValue != null
	if (yLength > 0)
	{
		lastValue = data.y[yLength-1];
		// when activity ends "null" is additionally added at the same time to mark it
		shouldAdd = newValue !== lastValue || newValue != null && x > data.x[yLength-1];
	}
	if (shouldAdd)
	{
		addTimelineValue(x, newValue, data);
		if (newValue != null ^ lastValue != null) // has started or ended
		{
			const markerValue = lastValue == null ? newValue : lastValue;
			markersData.x.push(x)
			markersData.y.push(markerValue);
		}
	}
}

function updateTimeAxisLayout(chart, jsonData)
{
	let timeAxis = chart.layout.xaxis;
	let updatedRange = getUpdatedTimeAxisRange(jsonData, chart.layout);
	if (updatedRange != null)
	{
		timeAxis.range = updatedRange;
	}
	let timeAxisTickStep = jsonData.timeAxisTickStep
	if (timeAxisTickStep !== timeAxis.dtick)
	{
		timeAxis.dtick = timeAxisTickStep; // assigning this to null allows 'nticks' parameter to take effect
	}
}

function plotTimeline(jsonData)
{
	const divID = jsonData.divID;
	const chart = document.getElementById(divID);

	if (chart.data === undefined)
	{
		return;
	}

	const isActivityMode = jsonData.mode === "activity"; // or else is state
	let dataArray = chart.data;
	let indices = jsonData.startIndices;
	let values = jsonData.values;
	let x = jsonData.x;
	for (let i = 0; i < indices.length; i++)
	{
		let dataIndex = indices[i]; // offset, as sometimes a subset of values is updated in the middle (when single plot/yAxis changes)
		for (const newValue of values[i])
		{
			const data = dataArray[dataIndex];
			if (isActivityMode)
			{
				const markersData = dataArray[dataArray.length / 2 + dataIndex];
				updateValueForActivityTimeline(x, newValue, data, markersData);
			}
			else
			{
				addTimelineValue(x, newValue, data);
			}
			dataIndex++;
		}
	}
	updateTimeAxisLayout(chart, jsonData, divID);
	redrawPlotLater(divID);
}

function addTimelineAnnotations(jsonData)
{
	let divID = jsonData.divID;
	let chart = document.getElementById(divID);
	let layout = chart.layout;
	if (chart.layout === undefined)
	{
		return;
	}
	for (const annotation of jsonData.annotations)
	{
		layout.annotations.push(createAnnotation(annotation));
	}
	redrawPlotLater(divID);
}

function createTimeSeriesPlot(jsonData) {
	const divID = jsonData.divID;
	const traces = jsonData.traces;
	const title = jsonData.title;
	const xLabel = jsonData.xLabel;
	const yLabel = jsonData.yLabel;
	const xUpper = jsonData.xUpperBound;
	const xLower = jsonData.xLowerBound;
	const yUpper = jsonData.yUpperBound;
	const yLower = jsonData.yLowerBound;
	const values = jsonData.values;
	const x = jsonData.x;
	const colors = jsonData.colors;
	const linearInterpolation = jsonData.linearInterpolation;
	const loadedTimeSeries = jsonData.loadedTimeSeries;

	const data = [];
	for (let i = 0; i < traces.length; i++) {
		let color = '';
		if (colors.length > i) {
			color = colors[i];
		}
		data[i] = { x: x[i], y: values[i], name: traces[i], mode: 'lines', line: {color: color}, loaded: false };
		if (data[i].y == null) {
			data[i].y = [];
		}
		if (linearInterpolation !== undefined && !linearInterpolation) {
			data[i].line.shape = 'hv';
		}
	}

	if (loadedTimeSeries !== undefined) {
		for (let j = 0; j < loadedTimeSeries.length; j++) {
			const loaded = loadedTimeSeries[j];
			for (let k = 0; k < loaded.loadedTraces.length; k++) {
				const index = data.length;
				data[index] = {
					x: loaded.loadedX.slice(),
					y: loaded.loadedValues[k],
					name: loaded.loadedTraces[k],
					mode: 'lines',
					line: {
						dash: 'dot'
					},
					loaded: true
				};
				if (linearInterpolation !== undefined && !linearInterpolation) {
					data[index].line.shape = 'hv';
				}
			}
		}
	}

	let xRange = [];
	if (xUpper !== undefined && xLower !== undefined) {
		xRange = [xLower, xUpper];
	}
	let yRange = [];
	if (yUpper !== undefined && yLower !== undefined) {
		yRange = [yLower, yUpper];
	}

	const layout = {
		title: title,
		xaxis: {
			title: xLabel,
			range: xRange,
			hoverformat: hoverFormat,
			rangemode : 'nonnegative'
		},
		yaxis: {
			title: yLabel,
			range: yRange,
			hoverformat: hoverFormat
		},
		legend: {
			x: 0.5,
			y: -0.2,
			orientation: "h",
			xanchor: "center"
		},
		margin: {
			t: 30,
			b: 0
		},
		showlegend: true
	};

	Plotly.newPlot(divID, data, layout, {responsive: true});
	onPlotCreated();
}

function repositionControlPanelForPlot()
{
	//Fix SIM-6955
	if ($("div[id][configID]").length === 1)
	{
		repositionControlPanel();
	}
}

function onPlotCreated()
{
	registerPlotUpdater();
	repositionControlPanelForPlot();
}

function registerPlotUpdater() {
	if (_plotUpdater == null) {
		_plotUpdater = setInterval(function() {
			_dirtyPlots.forEach(function(value) {
				Plotly.redraw(value);
			});
			_dirtyPlots.clear();
		}, _plotUpdaterInterval);
	}
}

function redrawPlotLater(divID) {
	_dirtyPlots.add(divID);
}

function plotTimeSeries(jsonData) {
	let divID = jsonData.divID;
	let traces = jsonData.traces;
	let values = jsonData.values;
	let x = jsonData.x;
	let xUpper = jsonData.xUpperBound;
	let xLower = jsonData.xLowerBound;
	let yUpper = jsonData.yUpperBound;
	let yLower = jsonData.yLowerBound;

	let chart = document.getElementById(divID);

	if (xUpper !== undefined && xLower !== undefined) {
		chart.layout.xaxis.range = [xLower, xUpper];
	}
	if (yUpper !== undefined && yLower !== undefined) {
		chart.layout.yaxis.range = [yLower, yUpper];
	}

	let dataArray = chart.data;
	let length = dataArray.length;
	for (let i = 0; i < length; i++) {
		for (let j = 0; j < traces.length; j++) {
			if (traces[j] === dataArray[i].name && !dataArray[i].loaded) {
				dataArray[i].x.push(x);
				dataArray[i].y.push(values[j]);
				break;
			}
		}
	}

	redrawPlotLater(divID);
}

function addTimeSeries(jsonData) {
	let divID = jsonData.divID;
	let traces = jsonData.traces;
	let title = jsonData.title;
	let yLabel = jsonData.yLabel;
	let colors = jsonData.colors;
	let linearInterpolation = jsonData.linearInterpolation;

	let chart = document.getElementById(divID);
	chart.layout.title = title;
	chart.layout.yaxis.title = yLabel;

	let newData = [];
	for (let i = 0; i < traces.length; i++) {
		let color = '';
		if (colors.length > i) {
			color = colors[i];
		}
		newData[i] = { x: [], y: [], name: traces[i], mode: 'lines', line: {color: color} };
		if (linearInterpolation !== undefined && !linearInterpolation) {
			newData[i].line.shape = 'hv';
		}
	}

	Plotly.addTraces(divID, newData);

	redrawPlotLater(divID);
}

function sendPlotImage(divID) {
	var chart = document.getElementById(divID);
	Plotly.toImage(chart)
		.then(function(png){
			var json = {
				"method" : "setPlotImage",
				"divID" : divID,
				"image" : png
			};
			sendMessage(JSON.stringify(json));
		});
}

function registerImageSwitcher() {
	$("img[runtime=true][id]").each(function(index, item) {
		doRegisterImageSwitcher($(this).attr('id'), $(this).parent());
	});
}

//registers image switcher via ws.
function doRegisterImageSwitcher(id, parentDiv) {
	var paths = null;
	var represents = null;
	var parentRepresents = null;
	var allowEmptyImage = null;
	if ("div" == getHTMLType(parentDiv)) {
		paths = $(parentDiv).attr('paths');
		represents = findRepresents($(parentDiv));
		parentRepresents = findParentRepresents($(parentDiv));
		allowEmptyImage = $(parentDiv).attr('allowEmptyImage');
	}
	var json = {
		"method" : "registerImageSwitcher",
		"id" : id,
		"paths" : paths,
		"represents" : represents,
		"parentRepresents" : parentRepresents,
		"allowEmptyImage" : allowEmptyImage
	};
	sendMessage(JSON.stringify(json));
}

function registerExecutionStatus() {
	$("body[isLinkPage!=true][class!=widget]").each(function(index, item) {
		$.get(_servletPath, { method : "getSimulationControlPanel" }, function(data, status) {
			if (data !== undefined && data !== "") {
				var body = $("body");
				body.append(data);

				var controlPanel = $("div#SimulationControlPanel");
				controlPanel.css("position", "absolute");
				controlPanel.css("left", "10px");

				repositionControlPanel();

				var json = {
					"method" : "registerExecutionStatus"
				};
				sendMessage(JSON.stringify(json));
			}
		});
	});

	$("div#ConfigLinks").each(function(index, item) {
		var div = $(this);
		$.get(_servletPath, { method : "getConfigLinks" }, function(data, status) {
			if (data !== undefined && data !== "") {
				var jsonData = JSON.parse(data);
				div.append(jsonData.links);
				var title = $("title");
				title.append(jsonData.title);
			}
		});
	});
}

function loadNestedWidgets() {
	$("iframe[runtime=true]").each(function(index, item) {
		$.get(_servletPath, {
				  method : _getWidgetPath,
				  parentRepresents : $(item).attr('parentRepresents'),
				  paths : $(item).attr('paths'),
				  src : $(item).attr('src') },
			  function(data, status) {
				  if (data !== undefined && data !== "") {
					  $(item).attr("src", data);
				  }
			  });
	});
}

function repositionControlPanel() {
	if (!controlPanelDragged) // don't move if user manually changed position
	{
		var controlPanel = $("div#SimulationControlPanel");
		var maxHeight = (getMaxHeight() + 20) + "px";
		controlPanel.css("top", maxHeight);
	}
}

//elementID is nullable
//paths is nullable
//parentRepresents is nullable
function switchImage(elementID, paths, represents, parentRepresents) {
	if (elementID !== undefined) {
		if (parentRepresents !== undefined) {
			if (paths !== undefined) {
				var imgElement = $('*[represents="' + parentRepresents + '"]').find('div[represents="' + represents + '"][paths="' + paths + '"] img[id="' + elementID + '"]');
				imgElement.show();
				imgElement.siblings("img").hide();
			} else {
				var imgElement = $('*[represents="' + parentRepresents + '"]').find('div[represents="' + represents + '"] img[id="' + elementID + '"]');
				imgElement.show();
				imgElement.siblings("img").hide();
			}
		} else {
			if (paths !== undefined) {
				var imgElement = $('div[represents="' + represents + '"][paths="' + paths + '"] img[id="' + elementID + '"]');
				imgElement.show();
				imgElement.siblings("img").hide();
			} else {
				var imgElement = $('div[represents="' + represents + '"] img[id="' + elementID + '"]');
				imgElement.show();
				imgElement.siblings("img").hide();
			}
		}
	} else {
		if (parentRepresents !== undefined) {
			if (paths !== undefined) {
				var divElement = $('*[represents="' + parentRepresents + '"]').find('div[represents="' + represents + '"][paths="' + paths + '"][allowEmptyImage]');
				var imgElement = $(divElement).children('img[id="' + elementID + '"]');
				if (imgElement.length == 0) {
					$(divElement).children("img").hide();
				} else {
					imgElement.show();
					imgElement.siblings("img").hide();
				}
			} else {
				var divElement = $('*[represents="' + parentRepresents + '"]').find('div[represents="' + represents + '"][allowEmptyImage]');
				var imgElement = $(divElement).children('img[id="' + elementID + '"]');
				if (imgElement.length == 0) {
					$(divElement).children("img").hide();
				} else {
					imgElement.show();
					imgElement.siblings("img").hide();
				}
			}
		} else {
			if (paths !== undefined) {
				var divElement = $('div[represents="' + represents + '"][paths="' + paths + '"][allowEmptyImage]');
				var imgElement = $(divElement).children('img[id="' + elementID + '"]');
				if (imgElement.length == 0) {
					$(divElement).children("img").hide();
				} else {
					imgElement.show();
					imgElement.siblings("img").hide();
				}
			} else {
				var divElement = $('div[represents="' + represents + '"][allowEmptyImage]');
				var imgElement = $(divElement).children('img[id="' + elementID + '"]');
				if (imgElement.length == 0) {
					$(divElement).children("img").hide();
				} else {
					imgElement.show();
					imgElement.siblings("img").hide();
				}
			}
		}
	}
}

function updateAnnotations(removedAnnotations, addedAnnotations) {
	if (removedAnnotations !== undefined) {
		for (var i = 0; i < removedAnnotations.length; i++) {
			var annotationID = removedAnnotations[i].annotationID;

			var gElement = $('g#' + annotationID);
			gElement.css("stroke-width", "0");
			gElement.css("stroke", "");

			gElement.removeAttr("annotationText");
		}
	}

	if (addedAnnotations !== undefined) {
		for (var i = 0; i < addedAnnotations.length; i++) {
			var annotationID = addedAnnotations[i].annotationID;
			var annotationText = addedAnnotations[i].annotationText;
			var annotationColor = addedAnnotations[i].annotationColor;

			var gElement = $('g#' + annotationID);
			gElement.css("stroke-width", "2");
			gElement.css("stroke", annotationColor);

			gElement.attr("annotationText", annotationText);
		}
	}
}

function changeComponentProperties(paths, foregroundColor, backgroundColor, tooltipText) {
	if (tooltipText === undefined) {
		tooltipText = "";
	}
	var components = $('[runtime=true][pathType="name"][paths="' + paths + '"]');
	components.each(function(index, item) {
		if ("label" == getHTMLType($(this))) {
			var fgColor = foregroundColor === undefined ? "" : foregroundColor;
			var bgColor = backgroundColor === undefined ? "" : backgroundColor;
			$(this).parent().css('color', fgColor);
			$(this).parent().css('background-color', bgColor);
			if (tooltipText !== undefined) {
				$(this).attr('title', tooltipText);
			}
		} else if ("textfield" == getHTMLType($(this)) || "td" == getHTMLType($(this))) {
			var fgColor = foregroundColor === undefined ? "inherit" : foregroundColor;
			var bgColor = backgroundColor === undefined ? ($(this).attr("defaultBG") !== undefined ? $(this).attr("defaultBG") : "inherit") : backgroundColor;
			$(this).css('color', fgColor);
			$(this).css('background-color', bgColor);
			if (tooltipText !== undefined) {
				$(this).attr('title', tooltipText);
			}
		}
	});
}

function sendMessage(message) {
	_ws.send(message);
}

function updateValue(pathType, paths, value, formattedValue) {
	$("[runtime=true][pathType=\"" + pathType + "\"][paths=\"" + paths + "\"]").each(function(index, item) {
		setHTMLValue($(this), value, formattedValue);
	});
}

function updateWidgetValue(pathType, parentPaths, paths, value, formattedValue) {
	var selector = ".widget[paths='" + parentPaths + "']";
	$(selector).each(function(parentIndex, parentItem) {
		$(parentItem).find("[runtime=true][pathType=widget]").each(function(index, item) {
			if ($(item).attr('paths') == paths) {
				setHTMLValue(item, value, formattedValue);
			}
		});
	});
}

function updateVerificationStatus(pathType, paths, componentType, data) {
	if (componentType == "label") {
		$("label[runtime=true][pathType=\"" + pathType + "\"][paths=\"" + paths + "\"]").each(function(index, item) {
			initComponentProperties($(this).parent(), data);
		});
	} else if (componentType == "textfield") {
		$("input[type=textfield][runtime=true][pathType=\"" + pathType + "\"][paths=\"" + paths + "\"]").each(function(index, item) {
			initComponentProperties($(this), data);
		});
	} else if (componentType == "td") {
		$("td[runtime=true][pathType=\"" + pathType + "\"][paths=\"" + paths + "\"]").each(function(index, item) {
			initComponentProperties($(this), data);
		});
	}
}

function updateExecutionStatus() {
	$("div#SimulationControlPanel").each(function(index, item) {
		$.get(_servletPath, { method : "getExecutionStatus" }, function(data, status) {
			doUpdateExecutionStatus(data);
		});

		let panel = $(this);
		panel.draggable();
		panel.draggable("disable");
		panel.css('z-index', 1);
		panel.on("drag", () => {
			controlPanelDragged = true;
		});
	});
}

function doUpdateExecutionStatus(statusAsText) {
	var jsonData = JSON.parse(statusAsText);
	updateStartButtonsGroup(jsonData);
	updateStepIntoButton(jsonData);
	updateStepOverButton(jsonData);
}

function enableMove() {
	$("div#SimulationControlPanel input#MoveButton").each(function(index, item) {
		$(this).parent().draggable("enable");
		doEnableButton($(this));
		$(this).attr("onclick", "disableMove();");
		$(this).prop("title", "Disable Move");
	});
}

function disableMove() {
	$("div#SimulationControlPanel input#MoveButton").each(function(index, item) {
		$(this).parent().draggable("disable");
		doDisableButton($(this));
		$(this).attr("onclick", "enableMove();");
		$(this).prop("title", "Enable Move");
	});
}

function updateStartButtonsGroup(status) {
	if (status.restart !== undefined) {
		var button = getRestartButton();
		button.show();
		button.prop('title', status.restart);
		button.siblings("input").hide();

		disableButton(getStepIntoButton());
		disableButton(getStepOverButton());
		disableButton(getTerminateButton());
	} else if (status.ready && /*SIM-7431*/ !status.paused && !status.started) {
		var button = getStartButton();
		button.show();
		button.siblings("input").hide();
		if (status.readyEnabled) {
			enableButton(button);
		} else {
			disableButton(button);
		}
	} else if (status.paused) {
		var button = getResumeButton();
		button.show();
		button.siblings("input").hide();
		//Fix SIM-7202
		if (status.readyEnabled) {
			enableButton(button);
		} else {
			disableButton(button);
		}
	} else if (status.started) {
		var button = getPauseButton();
		button.show();
		button.siblings("input").hide();
		//Fix SIM-7243		
		if (status.readyEnabled) {
			enableButton(button);
		} else {
			disableButton(button);
		}
	}
}

function updateStepIntoButton(status) {
	var button = getStepIntoButton();
	if (status.stepIntoEnabled) {
		enableButton(button);
	} else {
		disableButton(button);
	}
}

function updateStepOverButton(status) {
	var button = getStepOverButton();
	if (status.stepOverEnabled) {
		enableButton(button);
	} else {
		disableButton(button);
	}
}

function disableButton(button) {
	button.prop('disabled', true);
	doDisableButton(button);
}

function doDisableButton(button) {
	button.fadeTo(500, _default_opacity);
}

function enableButton(button) {
	button.prop('disabled', false);
	doEnableButton(button)
}

function doEnableButton(button) {
	button.fadeTo(500, 1);
}

function disableSimulationControlPanelButtons() {
	$("div#SimulationControlPanel").each(function(index, item) {
		var startButton = getStartButton();
		startButton.show();
		startButton.siblings("input").hide();
		disableSimulationControlPanelButton(startButton);

		disableSimulationControlPanelButton(getStepIntoButton());
		disableSimulationControlPanelButton(getStepOverButton());
		disableSimulationControlPanelButton(getTerminateButton());
	});
}

function disableSimulationControlPanelButton(button) {
	disableButton(button);
	button.prop('title', 'Simulation web server has been terminated');
}

function initComponentProperties(component, data) {
	if (data !== undefined && data.trim().length > 0) {
		var jsonData = JSON.parse(data);
		var foregroundColor = jsonData.foregroundColor;
		var backgroundColor = jsonData.backgroundColor;
		var tooltipText = jsonData.tooltipText;
		if (foregroundColor !== undefined && backgroundColor !== undefined) {
			$(component).css('color', foregroundColor);
			$(component).css('background-color', backgroundColor);
			if (tooltipText !== undefined) {
				$(component).attr('title', tooltipText);
			}
		}
	}
}

function updateImageSwitcher(id, paths, represents, parentRepresents) {
	switchImage(id, paths, represents, parentRepresents);
}

function doStart() {
	$.get(_servletPath, { method : "start" });
}

function pause() {
	$.get(_servletPath, { method : "pause" });
}

function resume() {
	$.get(_servletPath, { method : "resume" });
}

function restart() {
	$.get(_servletPath, { method : "restart" });
}

function stepInto() {
	$.get(_servletPath, { method : "stepInto" });
}

function stepOver() {
	$.get(_servletPath, { method : "stepOver" });
}

function terminate() {
	$.get(_servletPath, { method : "terminate" });
}

function getStartButton() {
	return $("input#StartButton");
}

function getPauseButton() {
	return $("input#PauseButton");
}

function getResumeButton() {
	return $("input#ResumeButton");
}

function getRestartButton() {
	return $("input#RestartButton");
}

function getStepIntoButton() {
	return $("input#StepIntoButton");
}

function getStepOverButton() {
	return $("input#StepOverButton");
}

function getTerminateButton() {
	return $("input#TerminateButton");
}

function getMaxHeight()
{
	let elements = $('body').find('*:not(#SimulationControlPanel)');
	return Math.max.apply(null, elements.map(function () {
		return $(this).position().top + $(this).height();
	}).get());
}

function dispatchContentEditableOnChange() {
	var tags = document.querySelectorAll('[contenteditable=true][onchange]');
	for (var i = tags.length - 1; i >= 0; i--)
		if (typeof (tags[i].onblur) != 'function') {
			tags[i].onfocus = function() {
				this.data_orig = this.innerHTML;
			};
			tags[i].onblur = function() {
				//Fix SIM-6759
				$(this).html($(this).text().trim());

				if (this.innerHTML != this.data_orig) {
					this.onchange();
				}
				delete this.data_orig;
			};
		}
}

function lostFocusWhenEnterPressed() {
	$("td").keypress(function(evt) {
		if (evt.which == 13) {
			evt.preventDefault();
			$(this).blur();
		}
	});
	$("input[type=textfield]").keypress(function(evt) {
		if (evt.which == 13) {
			evt.preventDefault();
			$(this).blur();
		}
	});
}

function loadInlineSVG() {
	let svgDiv = $("div.svg");
	if (svgDiv.length > 0) {
		svgDiv.each(function(index, item) {
			$(this).load($(this).attr('src'), function(response, status, xhr) {
				$(this).find('g.element').css("stroke-width", "0");
			});
		});
	}
}

function setHTMLValue(item, data, formattedValue) {
	if (getHTMLType(item) == "textfield") {
		if (!$(item).is(":focus")) {
			$(item).val(data);
			wrap(item, formattedValue);
		}
	} else if (getHTMLType(item) == "label") {
		$(item).html(String(data));
		wrap(item, formattedValue);
	} else if (getHTMLType(item) == "checkbox") {
		if (isEqual(String(data), "true")) {
			$(item).prop('checked', true);
		} else {
			$(item).prop('checked', false);
		}
	} else if (getHTMLType(item) == "td") {
		$(item).html(String(data));
		wrap(item, formattedValue);
	} else if (getHTMLType(item) == "range" || getHTMLType(item) == "select") {
		$(item).val(data);
	} else if (getHTMLType(item) == "radio") {
		if (isEqual(String(data), $(item).val())) {
			$(item).prop('checked', true);
		}
	}

	customSetHTMLValue(item, data, formattedValue);
}

function customSetHTMLValue(item, data, formattedValue) {
	// is redeclared in some widget htmls to extend functionality
}

function getHTMLType(component) {
	var htmlType = customGetHTMLType(component);
	if (htmlType !== undefined) {
		return htmlType;
	} else if ($(component).is("input")) {
		return $(component).attr('type');
	} else if ($(component).is("label")) {
		return "label";
	} else if ($(component).is("td")) {
		return "td";
	} else if ($(component).is("div")) {
		return "div";
	} else if ($(component).is("select")) {
		return "select";
	} else {
		return component.tagName;
	}
}

function customGetHTMLType(component) {
	return $(component).attr("widgetType");
}

function isEqual(oldValue, newValue) {
	var equals = false;
	if (typeof oldValue === 'string') {
		oldValue = oldValue.trim();
	}
	if (typeof newValue === 'string') {
		newValue = newValue.trim();
	}
	if ((typeof oldValue === 'string' && oldValue.length == 0) || (typeof newValue === 'string' && newValue.length == 0)) {
		equals = oldValue === newValue;
	} else {
		equals = oldValue == newValue;
	}

	return equals;
}

function isString(p) {
	return typeof p == 'string';
}

function getType(p) {
	if (Array.isArray(p))
		return 'array';
	else if (typeof p == 'string')
		return 'string';
	else if (p != null && typeof p == 'object')
		return 'object';
	else
		return 'other';
}
