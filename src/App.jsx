// src/App.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { NavigationPane } from './NavigationPane';
import { ApplicationTable } from './ApplicationTable';
import { DetailPane } from './DetailPane';
import { AddAppForm } from './AddAppForm';
import { CSVLink } from "react-csv"; // *** 1. IMPORT CSVLink ***
// Assuming index.css contains all necessary styles including modal styles

function App() {
  const [loading, setLoading] = useState(true); // Loading state for the main application list
  const [applications, setApplications] = useState([]); // Holds the list of applications displayed in the table

  // State to track the currently selected item in the detail pane { id: UUID, type: 'application' | 'market' | 'ontology' }
  const [selectedItem, setSelectedItem] = useState({ id: null, type: null });

  // State for search and filtering { type: 'market' | 'ontology' | null, id: UUID | null }
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState({ type: null, id: null });

  const [showAddForm, setShowAddForm] = useState(false); // Controls visibility of the Add form

  // State to hold the name of the selected market for the Add button text
  const [selectedMarketName, setSelectedMarketName] = useState('');


// *** 2. NEW STATE for CSV data preparation ***
  const [csvData, setCsvData] = useState([]);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvFilename, setCsvFilename] = useState("agm_applications.csv");
  // ********************************************


  // Fetch application data based on current search term and filters using the Supabase RPC function
  const fetchApplications = useCallback(async () => {
    setLoading(true); // Indicate loading start
    console.log('Fetching applications with filter:', filter, 'and search:', searchTerm);

    // Call the search_applications RPC function
    const { data: appData, error: appError } = await supabase.rpc('search_applications', {
      search_text: searchTerm || null, // Pass null if search term is empty
      market_id_filter: filter.type === 'market' ? filter.id : null, // Pass market ID or null
      ontology_id_filter: filter.type === 'ontology' ? filter.id : null, // Pass ontology ID or null
    });

    if (appError) {
      console.error('Error fetching applications:', appError);
      alert(`Error loading applications: ${appError.message}`);
      setApplications([]); // Clear data on error to prevent displaying stale info
    } else {
        // Successfully fetched app data (or empty array), now fetch ALL metrics
        const { data: metricsData, error: metricsError } = await supabase
            .from('application_metrics')
            .select('*'); // Select all metrics columns

        if (metricsError) {
            console.error('Error fetching metrics:', metricsError);
            // Non-critical error: Show applications even if metrics fail to load
            setApplications(appData || []);
            alert("Warning: Could not load application scores/metrics.");
        } else {
            // Create a Map for efficient lookup of metrics by application_id
            const metricsMap = new Map((metricsData || []).map(m => [m.application_id, m]));
            // Combine application data with its corresponding metrics
            const flatData = (appData || []).map(app => ({
              ...app, // Spread application properties
              // Spread metrics found in the map, use empty object as fallback if no metrics exist
              ...(metricsMap.get(app.id) || {})
            }));
            setApplications(flatData); // Update state with combined data
        }
    }
    setLoading(false); // Indicate loading finished
  }, [searchTerm, filter]); // Dependency array: Re-run fetchApplications if searchTerm or filter changes

  // Fetch initial data on component mount and whenever fetchApplications function reference changes (due to dependencies)
  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  // Fetch the name of the selected market whenever the selected item changes
  // Used for context-aware "Add Application" button text
  useEffect(() => {
       if (selectedItem.type === 'market' && selectedItem.id) {
            setLoading(true); // Indicate loading briefly
            supabase.from('market_segments').select('name').eq('id', selectedItem.id).single()
             .then(({ data, error }) => {
                 if (error) console.error("Error fetching market name:", error);
                 setSelectedMarketName(data?.name || ''); // Update name or clear if error/not found
                 setLoading(false);
             });
       } else {
            setSelectedMarketName(''); // Clear name if selection is not a market
       }
   }, [selectedItem]); // Dependency array: Rerun when selectedItem changes


  // Handler called when a new application/venture is successfully added via the form
  const handleItemAdded = () => {
    setShowAddForm(false); // Close the add form
    // Reset filters and selection to ensure the new item is visible and context is cleared
    setSearchTerm('');
    setFilter({ type: null, id: null });
    setSelectedItem({ id: null, type: null });
    // Refetch the application list to include the newly added item
    // Note: This might not immediately update NavigationPane counts until next full refresh/RPC call
    fetchApplications();
    // TODO: Consider adding a function to force-refresh NavigationPane tree data here if needed
  };

  // Generic handler called when ANY item (App, Market, Ontology) is updated in DetailPane
  const handleItemUpdated = () => {
    console.log("Item updated in DetailPane, refetching application list for potential score/name changes...");
    // Refetch the main application list; this updates scores in the table
    fetchApplications();
    // OPTIONAL: Also refetch NavigationPane data if item update could affect counts/names
    // Example: Manually trigger useEffect in NavigationPane or lift state up further
  };

  // Handler for when an APPLICATION row is clicked in the ApplicationTable
  const handleAppSelected = (appId) => {
    console.log("Application selected in table:", appId);
    setSelectedItem({ id: appId, type: 'application' }); // Update selected item state
  };

  // Handler for when a MARKET or ONTOLOGY item is clicked in the NavigationPane
  const handleFilterChange = (newFilter) => {
     console.log("Filter/Selection changed in NavigationPane:", newFilter);
     setFilter(newFilter); // Update the filter state (triggers fetchApplications)

     // Update the detail pane selection based on the filter type
     if ((newFilter.type === 'market' || newFilter.type === 'ontology') && newFilter.id) {
        // If a market or ontology is clicked, show its details
        setSelectedItem({ id: newFilter.id, type: newFilter.type });
     } else if (!newFilter.type && !newFilter.id){
         // If filters are cleared (type is null), clear the detail pane selection
         setSelectedItem({ id: null, type: null });
     }
     // If only search term changes, filter.type remains null, so we don't change the detail pane selection
  };

  // Determine the text for the Add button based on context
  const getAddButtonText = () => {
    if (showAddForm) return 'Close Add Form';
    // Use the fetched selectedMarketName state
    if (selectedItem.type === 'market' && selectedMarketName) return `+ Add App to "${selectedMarketName}"...`;
    // Add similar logic for ontology if desired
    // if (selectedItem.type === 'ontology' && selectedOntologyName) return `+ Add App using "${selectedOntologyName}"...`;
    return '+ Add New Application Idea'; // Default text
  };

// *** 3. FUNCTION to prepare data for CSV export ***
  const prepareCsvData = (exportType = 'current_view') => {
    let dataToExport = [];
    if (exportType === 'current_view') {
      dataToExport = applications; // Use the currently filtered/searched list
      setCsvFilename(`agm_apps_${filter.type ? filter.type + '_' : ''}${searchTerm ? 'search_' : ''}${new Date().toISOString().split('T')[0]}.csv`);
    } else { // 'all' (could add more types later)
      // Note: For a true "all apps" export, you might need a separate fetch without filters
      // For now, let's just use the current 'applications' state as an example for 'all' too.
      // A better approach would fetch *all* if needed.
      dataToExport = applications; // Placeholder: Fetch all if implementing fully
       setCsvFilename(`agm_all_apps_${new Date().toISOString().split('T')[0]}.csv`);
    }

    if (!dataToExport || dataToExport.length === 0) {
      setCsvData([]);
      setCsvHeaders([]);
      alert("No data available to export in the current view.");
      return false; // Indicate no data
    }

    // Define Headers (adjust based on what you want in the CSV)
    const headers = [
      { label: "Application ID", key: "id" },
      { label: "B2B Component Name", key: "component_name" },
      { label: "Legacy Name", key: "legacy_name" },
      { label: "Description", key: "description" },
      { label: "Status", key: "status" },
      { label: "Priority Score", key: "priority_score" },
      { label: "Strategic Synergy", key: "strategic_synergy" },
      { label: "IP Defensibility", key: "ip_defensibility" },
      { label: "Price Premium", key: "potential_price_premium" },
      { label: "Capital Efficiency", key: "capital_efficiency" },
      { label: "Market Access", key: "market_access" },
      { label: "Tech Feasibility", key: "technical_feasibility" },
      // Add linked markets/ontologies if needed (requires processing the arrays)
    ];
    setCsvHeaders(headers);

    // Format Data (flattening if necessary, handling nulls)
    const formattedData = dataToExport.map(app => ({
      id: app.id || '',
      component_name: app.component_name || '',
      legacy_name: app.legacy_name || '',
      description: (app.description || '').replace(/[\n\r,"]/g, ' '), // Basic CSV cleanup
      status: app.status || '',
      priority_score: app.priority_score?.toFixed(1) ?? '',
      strategic_synergy: app.strategic_synergy ?? '',
      ip_defensibility: app.ip_defensibility ?? '',
      potential_price_premium: app.potential_price_premium ?? '',
      capital_efficiency: app.capital_efficiency ?? '',
      market_access: app.market_access ?? '',
      technical_feasibility: app.technical_feasibility ?? '',
    }));
    setCsvData(formattedData);
    return true; // Indicate data is ready
  };
  // *************************************************



  return (
    // Main container using flexbox for layout
    <div style={{ padding: '0 20px 20px 20px', fontFamily: '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', height: 'calc(100vh - 40px)', /* Adjust height accounting for padding */ display: 'flex', flexDirection: 'column' }}>
      {/* Header section */}
	{/* Header section */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', flexShrink: 0, borderBottom: '1px solid #eee', marginBottom: '10px' }}>
        <h1>  Advanced Graphene Materials - Applications Explorer</h1> {/* <-- NAME WAS CHANGED HERE as requested */}

        {/* Wrapper Div for Buttons on the right */}
        <div>
           {/* --- CSV EXPORT BUTTON --- */}
           {/* Button 1: Export Current View */}
           {/* Only render if there's data to export */}
           {applications && applications.length > 0 && (
             <CSVLink
               data={csvData}
               headers={csvHeaders}
               filename={csvFilename}
               className="csv-export-button" // Class for styling
               target="_blank" // Open in new tab/window
               asyncOnClick={true} // Needed for async data preparation
               onClick={(event, done) => {
                 // Prepare data; returns true if successful
                 const dataReady = prepareCsvData('current_view');
                 if (dataReady) {
                   // Add a small delay to allow state update before download
                   setTimeout(done, 250);
                 } else {
                   // Prevent default download if prepareCsvData returned false (e.g., no data)
                   event.preventDefault(); // Stop the link click
                   console.warn("CSV Export prevented: No data prepared.");
                   // Optionally provide user feedback here
                 }
               }}
             >
               Export Current View (.csv) 📄
             </CSVLink>
           )}
           {/* --- END CSV EXPORT BUTTON --- */}

           {/* --- Add New Venture Button --- */}
           <button
             onClick={() => setShowAddForm(!showAddForm)} // Toggle form visibility
             style={{fontSize: '1em', padding: '10px 15px', marginLeft: '10px', /* Add spacing */ cursor: 'pointer', background: '#007bff', color: 'white', border: 'none', borderRadius: '5px'}}
             title={showAddForm ? "Close the form" : "Open form to add a new application idea. If a market/function is selected, it will be pre-linked."}
           >
             {getAddButtonText()} {/* Use dynamic button text */}
           </button>
           {/* --- END Add New Venture Button --- */}
        </div>
        {/* End Button Wrapper Div */}
      </header>

      {/* Conditionally render the AddAppForm component */}
      {showAddForm && (
        // Wrap form in a scrollable container if it might get too long
        <div className="add-app-form-container" style={{ maxHeight: 'calc(100vh - 150px)', overflowY: 'auto', marginBottom: '10px', border: '1px solid #ccc', borderRadius: '8px', background:'#fefefe' }}>
            <AddAppForm
               onFinished={handleItemAdded} // Handler to call when form is submitted successfully
               // Pass the selected market ID to pre-select it in the form's linker
               preSelectedMarketId={selectedItem.type === 'market' ? selectedItem.id : null}
               // Pass selected ontology ID if needed similarly
               // preSelectedOntologyId={selectedItem.type === 'ontology' ? selectedItem.id : null}
            />
        </div>
      )}

      {/* Main 3-panel layout using react-resizable-panels */}
      <PanelGroup direction="horizontal" style={{ flexGrow: 1, /* Take remaining vertical space */ border: '1px solid #ccc', borderRadius: '8px', overflow: 'hidden' /* Prevent scrollbars on group */ }}>
        {/* Pane 1: Navigation */}
        <Panel defaultSize={20} minSize={15} style={{ overflowY: 'auto', background: '#f8f9fa' }}> {/* Vertical scroll only */}
          <NavigationPane
            onSearchChange={setSearchTerm} // Pass setter for search term
            onFilterChange={handleFilterChange} // Pass the combined filter/selection handler
            currentFilter={filter} // Pass current filter state for highlighting active item
          />
        </Panel>
        {/* Resizer handle */}
        <PanelResizeHandle style={{ width: '8px', background: '#e9ecef', borderLeft: '1px solid #ccc', borderRight: '1px solid #ccc', cursor: 'col-resize', flexShrink: 0 }} />

        {/* Pane 2: Application List Table */}
        <Panel defaultSize={45} minSize={30} style={{ display: 'flex', flexDirection: 'column' }}> {/* Use flex to let table container manage scroll */}
          <ApplicationTable
            data={applications} // Pass application data
            loading={loading} // Pass loading state
            // Pass only the application ID if an application is selected
            selectedAppId={selectedItem.type === 'application' ? selectedItem.id : null}
            onAppSelected={handleAppSelected} // Pass handler for selecting an app row
          />
        </Panel>
        {/* Resizer handle */}
        <PanelResizeHandle style={{ width: '8px', background: '#e9ecef', borderLeft: '1px solid #ccc', borderRight: '1px solid #ccc', cursor: 'col-resize', flexShrink: 0 }} />

        {/* Pane 3: Details Pane */}
        <Panel defaultSize={35} minSize={25} style={{ overflowY: 'auto' }}> {/* Vertical scroll only */}
          <DetailPane
            // Pass the full selected item state (ID and type)
            selectedItemId={selectedItem.id}
            selectedItemType={selectedItem.type}
            // Handler to clear selection when closed from within DetailPane
            onClose={() => setSelectedItem({ id: null, type: null })}
            // Handler to notify App.jsx when data is updated (e.g., score changes)
            onItemUpdated={handleItemUpdated}
          />
        </Panel>
      </PanelGroup>
    </div>
  );
}

export default App;