'use client';
import React from 'react';

interface DateFilterProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onClearFilter: () => void;
}

export default function DateFilter({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onClearFilter
}: DateFilterProps) {
  const formatDateForInput = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const setToday = () => {
    const today = formatDateForInput(new Date());
    onStartDateChange(today);
    onEndDateChange(today);
  };

  const setThisWeek = () => {
    const today = new Date();
    const firstDayOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
    const lastDayOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6));
    
    onStartDateChange(formatDateForInput(firstDayOfWeek));
    onEndDateChange(formatDateForInput(lastDayOfWeek));
  };

  const setThisMonth = () => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    onStartDateChange(formatDateForInput(firstDayOfMonth));
    onEndDateChange(formatDateForInput(lastDayOfMonth));
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md mb-6">
      <h3 className="text-lg font-semibold mb-4">Date Filter</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
            Start Date
          </label>
          <input
            type="date"
            id="startDate"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
            End Date
          </label>
          <input
            type="date"
            id="endDate"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div className="flex items-end">
          <button
            onClick={onClearFilter}
            className="w-full px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Clear Filter
          </button>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2">
        <button
          onClick={setToday}
          className="px-3 py-1 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 text-sm"
        >
          Today
        </button>
        <button
          onClick={setThisWeek}
          className="px-3 py-1 bg-green-100 text-green-800 rounded-md hover:bg-green-200 text-sm"
        >
          This Week
        </button>
        <button
          onClick={setThisMonth}
          className="px-3 py-1 bg-purple-100 text-purple-800 rounded-md hover:bg-purple-200 text-sm"
        >
          This Month
        </button>
      </div>
      
      {(startDate || endDate) && (
        <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-blue-800 text-sm">
            {startDate && endDate 
              ? `Showing records from ${startDate} to ${endDate}`
              : startDate 
                ? `Showing records from ${startDate} onwards`
                : `Showing records up to ${endDate}`
            }
          </p>
        </div>
      )}
    </div>
  );
} 