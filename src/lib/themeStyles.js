// Shared light theme styles for MUI DataGrid
export const dataGridStyles = {
  border: 'none',
  backgroundColor: '#ffffff',
  color: '#1f2937',
  fontFamily: 'inherit',
  '& .MuiDataGrid-columnHeaders': {
    backgroundColor: '#f3f4f6',
    borderBottom: '1px solid #e5e7eb',
  },
  '& .MuiDataGrid-columnHeaderTitle': {
    color: '#6b7280',
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  '& .MuiDataGrid-cell': {
    borderBottom: '1px solid #e5e7eb',
    color: '#1f2937',
  },
  '& .MuiDataGrid-row': {
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: '#f9fafb',
    },
  },
  '& .MuiDataGrid-row.Mui-selected': {
    backgroundColor: 'rgba(220, 38, 38, 0.05)',
    '&:hover': {
      backgroundColor: 'rgba(220, 38, 38, 0.08)',
    },
  },
  '& .MuiDataGrid-footerContainer': {
    backgroundColor: '#f9fafb',
    borderTop: '1px solid #e5e7eb',
  },
  '& .MuiTablePagination-root': {
    color: '#6b7280',
  },
  '& .MuiIconButton-root': {
    color: '#6b7280',
  },
  '& .MuiIconButton-root.Mui-disabled': {
    color: '#d1d5db',
  },
  '& .MuiDataGrid-overlay': {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  '& .MuiCheckbox-root': {
    color: '#9ca3af',
  },
  '& .MuiDataGrid-columnSeparator': {
    color: '#e5e7eb',
  },
  '& .MuiDataGrid-menuIcon': {
    color: '#6b7280',
  },
  '& .MuiDataGrid-sortIcon': {
    color: '#6b7280',
  },
  '& .MuiSelect-icon': {
    color: '#6b7280',
  },
  '& .MuiInputBase-root': {
    color: '#1f2937',
  },
}

// Toast styles for light theme
export const toastOptions = {
  style: {
    background: '#ffffff',
    color: '#1f2937',
    border: '1px solid #e5e7eb',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  },
  success: {
    iconTheme: {
      primary: '#22c55e',
      secondary: '#ffffff',
    },
  },
  error: {
    iconTheme: {
      primary: '#EF4444',
      secondary: '#ffffff',
    },
  },
}
