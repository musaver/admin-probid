'use client';
import React, { useState, useEffect } from 'react';

interface Batch {
  id: string;
  batchName: string;
}

interface ZoomLinkData {
  zoomLink: {
    id: number;
    url: string;
    batchId: string;
  };
  batch: {
    id: string;
    batchName: string;
  };
}

export default function ZoomLinkForm() {
  const [url, setUrl] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [allZoomLinks, setAllZoomLinks] = useState<ZoomLinkData[]>([]);
  const [currentZoomLink, setCurrentZoomLink] = useState<ZoomLinkData | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchBatches();
    fetchAllZoomLinks();
  }, []);

  useEffect(() => {
    // Update current zoom link when batch selection changes
    if (selectedBatchId) {
      const zoomLinkForBatch = allZoomLinks.find(
        link => link.zoomLink.batchId === selectedBatchId
      );
      if (zoomLinkForBatch) {
        setCurrentZoomLink(zoomLinkForBatch);
        setUrl(zoomLinkForBatch.zoomLink.url);
        setIsEditing(true);
      } else {
        setCurrentZoomLink(null);
        setUrl('');
        setIsEditing(false);
      }
    } else {
      setCurrentZoomLink(null);
      setUrl('');
      setIsEditing(false);
    }
  }, [selectedBatchId, allZoomLinks]);

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/batches');
      const data = await response.json();
      // Extract batches from the response format
      const batchData = data.map((item: any) => ({
        id: item.batch.id,
        batchName: item.batch.batchName
      }));
      setBatches(batchData);
    } catch (error) {
      console.error('Error fetching batches:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllZoomLinks = async () => {
    try {
      const response = await fetch('/api/zoom-links');
      const data = await response.json();
      
      if (Array.isArray(data)) {
        setAllZoomLinks(data);
      } else {
        setAllZoomLinks([]);
      }
    } catch (error) {
      console.error('Error fetching zoom links:', error);
      setAllZoomLinks([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url || !selectedBatchId) {
      alert('Please fill in all fields');
      return;
    }

    setSubmitLoading(true);
    try {
      const response = await fetch('/api/zoom-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          batchId: selectedBatchId,
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        // Refresh the zoom links data
        await fetchAllZoomLinks();
      } else {
        alert(result.error || 'Failed to save zoom link');
      }
    } catch (error) {
      console.error('Error submitting zoom link:', error);
      alert('Error submitting zoom link');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!currentZoomLink || !selectedBatchId) {
      return;
    }

    if (!confirm('Are you sure you want to delete this zoom link?')) {
      return;
    }

    setDeleteLoading(true);
    try {
      const response = await fetch(`/api/zoom-links?batchId=${selectedBatchId}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      
      if (response.ok) {
        // Refresh the zoom links data
        await fetchAllZoomLinks();
        // Reset current form state
        setUrl('');
        setCurrentZoomLink(null);
        setIsEditing(false);
      } else {
        alert(result.error || 'Failed to delete zoom link');
      }
    } catch (error) {
      console.error('Error deleting zoom link:', error);
      alert('Error deleting zoom link');
    } finally {
      setDeleteLoading(false);
    }
  };

  const getBatchZoomLinkStatus = (batchId: string) => {
    return allZoomLinks.find(link => link.zoomLink.batchId === batchId);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">
        {isEditing ? 'Edit Zoom Link' : 'Add Zoom Link'}
      </h2>
      
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-blue-800 text-sm">
          ℹ️ Each batch can have one zoom link. Select a batch to view, add, or edit its zoom link.
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="batch" className="block text-sm font-medium text-gray-700 mb-2">
            Select Batch
          </label>
          {loading ? (
            <div className="text-gray-500">Loading batches...</div>
          ) : (
            <select
              id="batch"
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select a batch...</option>
              {batches.map((batch) => {
                const hasZoomLink = getBatchZoomLinkStatus(batch.id);
                return (
                  <option 
                    key={batch.id} 
                    value={batch.id}
                  >
                    {batch.batchName}
                    {hasZoomLink ? ' ✓ (Has zoom link)' : ' (No zoom link)'}
                  </option>
                );
              })}
            </select>
          )}
        </div>

        <div>
          <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
            Zoom URL
          </label>
          <input
            type="url"
            id="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://zoom.us/j/..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {selectedBatchId && (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
            <p className="text-gray-700 text-sm">
              {isEditing 
                ? `This batch currently has a zoom link. You can update it or delete it.`
                : `This batch doesn't have a zoom link yet. You can create one.`
              }
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitLoading || !selectedBatchId}
            className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {submitLoading ? 'Saving...' : (isEditing ? 'Update Zoom Link' : 'Add Zoom Link')}
          </button>
          
          {isEditing && currentZoomLink && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteLoading}
              className="bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
            >
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      </form>

      {/* Show existing zoom links summary */}
      {allZoomLinks.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-3">Existing Zoom Links</h3>
          <div className="space-y-2">
            {allZoomLinks.map((linkData) => (
              <div key={linkData.zoomLink.id} className="p-3 bg-green-50 border border-green-200 rounded-md">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-green-800">{linkData.batch.batchName}</p>
                    <p className="text-sm text-green-600 truncate">{linkData.zoomLink.url}</p>
                  </div>
                  <button
                    onClick={() => setSelectedBatchId(linkData.zoomLink.batchId)}
                    className="text-blue-600 text-sm hover:underline"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 