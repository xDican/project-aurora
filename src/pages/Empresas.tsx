import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CompanyForm, type CompanyFormData } from "@/components/companies/CompanyForm";
import { toast } from "sonner";
import { useCompanies, type Company } from "@/hooks/useCompanies";
import { Loader2 } from "lucide-react";
import { es } from "@/lib/i18n/es";

const { empresasPage, common } = es;

export default function Empresas() {
  const {
    companies,
    loading,
    error,
    search,
    setSearch,
    createCompany,
    updateCompany,
    archiveCompany,
  } = useCompanies();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreateModal = () => {
    setEditingCompany(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (company: Company) => {
    setEditingCompany(company);
    setFormError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCompany(null);
    setFormError(null);
  };

  const mapFormError = (code: string): string => {
    if (code === "RTN_TAKEN") return empresasPage.validation.rtnTaken;
    if (code === "RTN_INVALID") return empresasPage.validation.rtnInvalid;
    if (code === "NOT_ALLOWED") return empresasPage.notAllowed;
    return code;
  };

  const handleSubmit = async (data: CompanyFormData) => {
    setIsSaving(true);
    setFormError(null);

    try {
      if (editingCompany) {
        await updateCompany(editingCompany.id, data);
        toast.success(empresasPage.companyUpdated);
      } else {
        await createCompany(data);
        toast.success(empresasPage.companyCreated);
      }
      closeModal();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : common.unexpectedError;
      setFormError(mapFormError(errorMessage));
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async (companyId: string) => {
    try {
      await archiveCompany(companyId);
      toast.success(empresasPage.archive.success);
    } catch (err) {
      if (err instanceof Error && err.message === "NOT_ALLOWED") {
        toast.error(empresasPage.archive.notAllowed);
      } else {
        toast.error(empresasPage.archive.error);
      }
    }
  };

  const displayValue = (value: string | null | undefined) => value || "—";

  if (error) {
    toast.error(error);
  }

  return (
    <div className="space-y-stack_gap_md">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-headline-md text-foreground font-bold">{empresasPage.title}</h2>
        <Button onClick={openCreateModal} className="gap-2">
          <span className="material-symbols-outlined text-[18px]">domain_add</span>
          {empresasPage.addCompany}
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">
          search
        </span>
        <Input
          placeholder={empresasPage.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          {es.common.loading}
        </div>
      ) : companies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-outline-variant p-12 text-center">
          <p className="text-on-surface-variant">
            {search ? `No se encontraron resultados para "${search}"` : empresasPage.noCompanies}
          </p>
          {!search && (
            <Button onClick={openCreateModal} variant="outline" className="mt-4 gap-2">
              <span className="material-symbols-outlined text-[18px]">domain_add</span>
              {empresasPage.addFirstCompany}
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low border-b border-outline-variant">
              <tr>
                <th className="px-table_cell_padding_x py-table_cell_padding_y text-label-bold text-on-surface-variant">{empresasPage.columns.name}</th>
                <th className="px-table_cell_padding_x py-table_cell_padding_y text-label-bold text-on-surface-variant">{empresasPage.columns.rtn}</th>
                <th className="px-table_cell_padding_x py-table_cell_padding_y text-label-bold text-on-surface-variant">{empresasPage.columns.phone}</th>
                <th className="px-table_cell_padding_x py-table_cell_padding_y text-label-bold text-on-surface-variant">{empresasPage.columns.email}</th>
                <th className="px-table_cell_padding_x py-table_cell_padding_y text-label-bold text-on-surface-variant text-right">{common.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {companies.map((company) => (
                <tr key={company.id} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-table_cell_padding_x py-table_cell_padding_y text-table-data text-foreground font-medium">
                    {company.name}
                  </td>
                  <td className="px-table_cell_padding_x py-table_cell_padding_y text-body-sm text-on-surface-variant">
                    {company.rtn}
                  </td>
                  <td className="px-table_cell_padding_x py-table_cell_padding_y text-body-sm text-on-surface-variant">
                    {displayValue(company.phone)}
                  </td>
                  <td className="px-table_cell_padding_x py-table_cell_padding_y text-body-sm text-on-surface-variant">
                    {displayValue(company.email)}
                  </td>
                  <td className="px-table_cell_padding_x py-table_cell_padding_y text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEditModal(company)}
                        title={es.common.edit}
                        className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-primary-container/20 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[20px]">edit</span>
                      </button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            title={common.actions}
                            className="p-1 rounded text-on-surface-variant hover:text-destructive hover:bg-error-container/20 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[20px]">archive</span>
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {empresasPage.archive.dialogTitle}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {empresasPage.archive.dialogMessage}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>
                              {empresasPage.archive.back}
                            </AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleArchive(company.id)}>
                              {empresasPage.archive.confirm}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCompany ? empresasPage.editCompany : empresasPage.newCompany}
            </DialogTitle>
          </DialogHeader>
          <CompanyForm
            company={editingCompany}
            onSubmit={handleSubmit}
            onCancel={closeModal}
            isLoading={isSaving}
            error={formError}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
