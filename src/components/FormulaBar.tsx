import React from 'react';
import { useWorkbookStore } from '../store/workbookStore';

export const FormulaBar: React.FC = () => {
  const activeCell = useWorkbookStore((s) => s.activeCell);

  return (
    <div className="excel-formula-bar">
      <div className="name-box" title="Aktiv katak koordinatasi">
        {activeCell.cellId || 'A1'}
      </div>
      <div className="fx-symbol">fx</div>
      <input
        type="text"
        className="formula-input"
        value={activeCell.formula || activeCell.value || ''}
        readOnly={activeCell.isReadOnly}
        placeholder=""
      />
    </div>
  );
};
