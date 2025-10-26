// src/App.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { NavigationPane } from './NavigationPane';
import { ApplicationTable } from './ApplicationTable';
import { DetailPane } from './DetailPane';
import { AddAppForm } from './AddAppForm';
import { CSVLink } from "react-csv"; // Import CSVLink

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

  // State to hold the name of the selected market/ontology for the Add button text
  const [selectedItemName, setSelectedItemName] = useState(''); // Generic name holder

  // State for CSV data preparation
  const [csvData, setCsvData] = useState([]);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvFilename, setCsvFilename] = useState("agm_applications.csv");
  const [isPreparingCsv, setIsPreparingCsv] = useState(false); // Prevent multiple clicks


  // Fetch application data based on current search term and filters using the Supabase RPC function
  // Accepts an optional app ID to try and select after fetching
  const fetchApplications = useCallback(async (selectAppId = null) => {
    setLoading(true);
    console.log('Fetching applications with filter:', filter, 'and search:', searchTerm);
    let finalApplications = []; // Use a temporary variable

    try {
        // Call the search_applications RPC function
        const { data: appData, error: appError } = await supabase.rpc('search_applications', {
          search_text: searchTerm || null,
          market_id_filter: filter.type === 'market' ? filter.id : null,
          ontology_id_filter: filter.type === 'ontology' ? filter.id : null,
        });
        if (appError) throw new Error(`App fetch failed: ${appError.message}`);

        // Fetch ALL metrics separately
        const { data: metricsData, error: metricsError } = await supabase
            .from('application_metrics')
            .select('*');
        if (metricsError) {
            console.error('Warning: Could not load application scores/metrics:', metricsError);
            // Proceed with app data only if metrics fail
            finalApplications = appData || [];
        } else {
            // Create a lookup map for metrics
            const metricsMap = new Map((metricsData || []).map(m => [m.application_id, m]));
            // Combine application data with its corresponding metrics
            finalApplications = (appData || []).map(app => ({
              ...app,
              ...(metricsMap.get(app.id) || {}) // Use empty object if no metrics found
            }));
        }

        setApplications(finalApplications); // Update state

        // If an app ID was passed (e.g., after adding), try to select it
        if (selectAppId && finalApplications.some(app => app.id === selectAppId)) {
            console.log("Automatically selecting newly added/updated app:", selectAppId);
            setSelectedItem({ id: selectAppId, type: 'application' });
        } else if (selectAppId) {
            console.warn(`App ID ${selectAppId} was requested for selection but not found in fetched results.`);
            // Optionally clear selection if the requested app isn't found
            // setSelectedItem({ id: null, type: null });
        }

    } catch (error) {
        console.error('Error in fetchApplications:', error);
        alert(`Error loading applications: ${error.message}`);
        setApplications([]); // Clear data on significant error
    } finally {
        setLoading(false); // Indicate loading finished
    }
  }, [searchTerm, filter]); // Dependency array

  // Fetch initial data on component mount
  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]); // Now depends on the stable useCallback reference

  // Fetch the name of the selected market/ontology whenever the selected item changes
  useEffect(() => {
       let isMounted = true;
       const fetchName = async () => {
            // Only fetch if ID and type are valid, and it's not an application
            if (!selectedItem.id || !selectedItem.type || selectedItem.type === 'application') {
                 if (isMounted) setSelectedItemName('');
                 return;
            }

            const tableName = selectedItem.type === 'market' ? 'market_segments' : 'ontology_tags';
            console.log(`Fetching name for ${selectedItem.type} ID: ${selectedItem.id}`);
            try {
                const { data, error } = await supabase
                    .from(tableName)
                    .select('name')
                    .eq('id', selectedItem.id)
                    .maybeSingle(); // Use maybeSingle to handle potential null result gracefully

                if (error) throw error;
                if (isMounted) setSelectedItemName(data?.name || ''); // Update name or clear if error/not found
            } catch (error) {
                 console.error(`Error fetching ${selectedItem.type} name:`, error);
                 if (isMounted) setSelectedItemName(''); // Clear name on error
            }
       };

       fetchName();
       // Cleanup function to prevent state updates if component unmounts during fetch
       return () => { isMounted = false; };
   }, [selectedItem]); // Dependency array: Rerun when selectedItem changes


  // Handler called when a new application/venture is successfully added via the form
  const handleItemAdded = (newAppId = null) => {
    setShowAddForm(false);
    setSearchTerm(''); // Clear search
    setFilter({ type: null, id: null }); // Clear filter
    // Keep selectedItem null for now, fetchApplications will select the new one
    setSelectedItem({ id: null, type: null });
    // Refetch the application list AND try to select the new app
    fetchApplications(newAppId);
    // TODO: Force-refresh NavigationPane tree data if counts need immediate update
  };

  // Generic handler called when ANY item (App, Market, Ontology) is updated in DetailPane
  const handleItemUpdated = () => {
    console.log("Item updated in DetailPane, refetching application list...");
    // Refetch the main application list; this updates scores in the table
    // Pass the currently selected App ID (if any) to try and re-select it after refetch
    fetchApplications(selectedItem.type === 'application' ? selectedItem.id : null);
    // OPTIONAL: Also refetch NavigationPane data if counts/names changed
    // forceNavRefresh(); // Needs implementation
  };

  // Handler for when an APPLICATION row is clicked in the ApplicationTable
  const handleAppSelected = (appId) => {
    console.log("Application selected in table:", appId);
    // Only update if the selection is actually changing
    if (selectedItem.id !== appId || selectedItem.type !== 'application') {
        setSelectedItem({ id: appId, type: 'application' });
    }
  };

  // Handler for when a MARKET or ONTOLOGY item is clicked in the NavigationPane
  const handleFilterChange = (newFilter) => {
     console.log("Filter/Selection changed in NavigationPane:", newFilter);
     setFilter(newFilter); // Update the filter state (triggers fetchApplications)

     // Update the detail pane selection based on the filter type
     if ((newFilter.type === 'market' || newFilter.type === 'ontology') && newFilter.id) {
        // Only update if the selection is changing
        if (selectedItem.id !== newFilter.id || selectedItem.type !== newFilter.type) {
            setSelectedItem({ id: newFilter.id, type: newFilter.type });
        }
     } else if (!newFilter.type && !newFilter.id){
         // If filters are cleared, clear the detail pane selection
         if (selectedItem.id || selectedItem.type) { // Only clear if something was selected
             setSelectedItem({ id: null, type: null });
         }
     }
     // If only search term changes, filter.type remains null, don't change detail selection
  };

  // Determine the text for the Add button based on context
  const getAddButtonText = () => {
    if (showAddForm) return 'Close Add Form';
    if (selectedItem.type === 'market' && selectedItemName) return `+ Add App to "${selectedItemName}"...`;
    if (selectedItem.type === 'ontology' && selectedItemName) return `+ Add App using "${selectedItemName}"...`;
    return '+ Add New IP Venture'; // Updated default text
  };

  // Function to prepare data for CSV export
  const prepareCsvData = useCallback((exportType = 'current_view') => {
    setIsPreparingCsv(true); // Indicate preparation start
    let dataToExport = [];
    let filename = "agm_export.csv"; // Default filename

    // Determine data source and filename
    if (exportType === 'current_view') {
      dataToExport = applications; // Use the currently displayed (filtered/searched) list
      const dateStr = new Date().toISOString().split('T')[0];
      const filterStr = filter.type ? `${filter.type}_` : '';
      const searchStr = searchTerm ? 'search_' : '';
      filename = `agm_apps_${filterStr}${searchStr}${dateStr}.csv`;
    }
    // Add 'all' case later with a separate fetch if needed
    // else if (exportType === 'all') { ... fetch all ... }

    // Check if there is data to export
    if (!dataToExport || dataToExport.length === 0) {
      setCsvData([]);
      setCsvHeaders([]);
      alert("No data available to export for the current view/filter.");
      setIsPreparingCsv(false);
      return false; // Indicate failure
    }

    // Define CSV Headers dynamically (can be customized)
    const headers = [
      { label: "B2B Component Name", key: "component_name" },
      { label: "Description", key: "description" },
      { label: "Status", key: "status" },
      { label: "Priority Score", key: "priority_score" },
      { label: "Strategic Synergy", key: "strategic_synergy" },
      { label: "IP Defensibility", key: "ip_defensibility" },
      { label: "Price Premium", key: "potential_price_premium" },
      { label: "Capital Efficiency", key: "capital_efficiency" },
      { label: "Market Access", key: "market_access" },
      { label: "Tech Feasibility", key: "technical_feasibility" },
      { label: "Legacy Name", key: "legacy_name" },
      { label: "Application ID", key: "id" },
      // TODO: Add linked markets/ontologies as comma-separated strings if needed
    ];
    setCsvHeaders(headers);
    setCsvFilename(filename);

    // Format Data for CSV (handle nulls, cleanup text)
    const formattedData = dataToExport.map(app => ({
      component_name: app.component_name || '',
      description: (app.description || '').replace(/[\n\r",]/g, ' '), // Remove newlines, commas, quotes
      status: app.status || '',
      priority_score: app.priority_score?.toFixed(1) ?? '', // Format score
      strategic_synergy: app.strategic_synergy ?? '',
      ip_defensibility: app.ip_defensibility ?? '',
      potential_price_premium: app.potential_price_premium ?? '',
      capital_efficiency: app.capital_efficiency ?? '',
      market_access: app.market_access ?? '',
      technical_feasibility: app.technical_feasibility ?? '',
      legacy_name: app.legacy_name || '',
      id: app.id || '',
    }));
    setCsvData(formattedData);
    setIsPreparingCsv(false); // Indicate preparation end
    return true; // Indicate success
  // Include dependencies needed inside useCallback
  }, [applications, filter, searchTerm]);


  return (
    // Main container
    <div style={{ padding: '0 20px 20px 20px', fontFamily: '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', height: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', flexShrink: 0, borderBottom: '1px solid #eee', marginBottom: '10px' }}>
        <h1>AGM IP Venture Explorer</h1>

        {/* Buttons Wrapper */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
           {/* CSV EXPORT BUTTON */}
           {/* Show only when not loading & data exists */}
           {!loading && applications && applications.length > 0 && (
             <CSVLink
               data={csvData}
               headers={csvHeaders}
               filename={csvFilename}
               className="csv-export-button" // Use class for styling
               target="_blank"
               asyncOnClick={true}
               onClick={(event, done) => {
                 // Prevent multiple rapid clicks while preparing
                 if (isPreparingCsv) {
                     event.preventDefault();
                     console.log("CSV preparation already in progress.");
                     return;
                 }
                 const dataReady = prepareCsvData('current_view');
                 if (dataReady) {
                   setTimeout(done, 250); // Small delay to ensure state update
                 } else {
                   event.preventDefault(); // Stop download if no data
                   console.warn("CSV Export prevented: No data prepared.");
                 }
               }}
               // Add disabled state visually
               style={isPreparingCsv ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
             >
               {isPreparingCsv ? 'Preparing...' : 'Export Current View (.csv) 📄'}
             </CSVLink>
           )}
           {/* END CSV BUTTON */}

           {/* ADD VENTURE BUTTON */}
           <button
             onClick={() => setShowAddForm(!showAddForm)}
             style={{fontSize: '1em', padding: '10px 15px', cursor: 'pointer', background: '#007bff', color: 'white', border: 'none', borderRadius: '5px'}}
             title={showAddForm ? "Close the form" : "Open form to add a new application idea. If a market/function is selected, it will be pre-linked."}
           >
             {getAddButtonText()}
           </button>
           {/* END ADD BUTTON */}
        </div>
      </header>

      {/* Conditionally render AddAppForm */}
      {showAddForm && (
        <div className="add-app-form-container" style={{ maxHeight: 'calc(100vh - 150px)', overflowY: 'auto', marginBottom: '10px', /* Add styles from index.css if needed */ }}>
            <AddAppForm
               onFinished={handleItemAdded}
               preSelectedMarketId={selectedItem.type === 'market' ? selectedItem.id : null}
               preSelectedOntologyId={selectedItem.type === 'ontology' ? selectedItem.id : null}
            />
        </div>
      )}

      {/* Main 3-panel layout */}
      <PanelGroup direction="horizontal" style={{ flexGrow: 1, border: '1px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
        {/* Pane 1: Navigation */}
        <Panel defaultSize={20} minSize={15} style={{ overflowY: 'auto', background: '#f8f9fa' }}>
          <NavigationPane
            onSearchChange={setSearchTerm}
            onFilterChange={handleFilterChange}
            currentFilter={filter}
          />
        </Panel>
        <PanelResizeHandle style={{ width: '8px', background: '#e9ecef', borderLeft: '1px solid #ccc', borderRight: '1px solid #ccc', cursor: 'col-resize', flexShrink: 0 }} />

        {/* Pane 2: Application List Table */}
        <Panel defaultSize={45} minSize={30} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 'var(--space-xl)' /* Prevent double scroll */ }}>
          <ApplicationTable
            data={applications}
            loading={loading}
            selectedAppId={selectedItem.type === 'application' ? selectedItem.id : null}
            onAppSelected={handleAppSelected}
          />
        </Panel>
        <PanelResizeHandle style={{ width: '8px', background: '#e9ecef', borderLeft: '1px solid #ccc', borderRight: '1px solid #ccc', cursor: 'col-resize', flexShrink: 0 }} />

        {/* Pane 3: Details Pane */}
        <Panel defaultSize={35} minSize={25} style={{ overflowY: 'auto' }}>
          <DetailPane
            selectedItemId={selectedItem.id}
            selectedItemType={selectedItem.type}
            onClose={() => setSelectedItem({ id: null, type: null })}
            onItemUpdated={handleItemUpdated}
          />
        </Panel>
      </PanelGroup>
    </div>
  );
}

export default App;