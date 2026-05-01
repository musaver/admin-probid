"use client";

import React, { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FileSpreadsheet,
  FileDown,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";

interface ImportedProperty {
  Title?: string;
  "Sale ID"?: string;
  "Parcel ID"?: string;
  Address?: string;
  City?: string;
  "Zip Code"?: number | string;
  "Minimum Bid"?: number;
  "Winning Bid"?: number;
  "Bidder Email"?: string;
  "Bidder Number"?: string;
  "Auction Start Date"?: string;
  "Auction End Date"?: string;
  Owners?: string;
  Status?: string;
  /** Legacy template headers — still recognized by import parser */
  "Winning Bidder Email"?: string;
  "Winning Bidder Number"?: string;
  "Redemption End Date"?: string;
}

interface CountyUser {
  id: string;
  name: string | null;
  email: string;
}

interface BulkUploadModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BulkUploadModal({
  open,
  onClose,
  onSuccess,
}: BulkUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<ImportedProperty[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [stage, setStage] = useState<"select" | "preview">("select");

  const [countyUsers, setCountyUsers] = useState<CountyUser[]>([]);
  const [countyUserId, setCountyUserId] = useState<string>("");
  const [loadingCounties, setLoadingCounties] = useState(false);
  /** When true, each row must have Parcel ID + Sale ID + Status; only updates `status` on existing properties. */
  const [statusOnlyImport, setStatusOnlyImport] = useState(false);

  useEffect(() => {
    if (open) {
      setLoadingCounties(true);
      fetch("/api/users?type=county&pageSize=all")
        .then((res) => res.json())
        .then((data) => {
          setCountyUsers(data.users || []);
        })
        .catch((err) => console.error("Failed to load county users:", err))
        .finally(() => setLoadingCounties(false));
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setData([]);
      setErrors([]);
      setUploading(false);
      setStage("select");
      setCountyUserId("");
      setStatusOnlyImport(false);
    }
  }, [open]);

  const downloadTemplate = (ext: "xlsx" | "xls" | "csv") => {
    const headers = [
      "Title",
      "Sale ID",
      "Parcel ID",
      "Address",
      "City",
      "Zip Code",
      "Minimum Bid",
      "Winning Bid",
      "Bidder Email",
      "Bidder Number",
      "Auction Start Date",
      "Auction End Date",
      "Owners",
      "Status",
    ];
    const sampleData = [
      {
        Title: "Example Property",
        "Sale ID": "2024-001",
        "Parcel ID": "12-34-567",
        Address: "123 Main St",
        City: "Anytown",
        "Zip Code": "12345",
        "Minimum Bid": 1000,
        "Winning Bid": 1200,
        "Bidder Email": "winner@example.com",
        "Bidder Number": "142",
        "Auction Start Date": "2026-05-01",
        "Auction End Date": "2026-06-01",
        Owners: "Doe, John; Smith, Jane",
        Status: "active",
      },
      {
        Title: "Vacant Lot",
        "Sale ID": "2024-002",
        "Parcel ID": "12-34-568",
        Address: "0 Oak Ave",
        City: "Anytown",
        "Zip Code": "12345",
        "Minimum Bid": 500,
        "Winning Bid": 0,
        "Bidder Email": "",
        "Bidder Number": "",
        "Auction Start Date": "",
        "Auction End Date": "2026-06-01",
        Owners: "Brown, Bob",
        Status: "active",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `ProBid_Property_Template.${ext}`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const parseFile = async () => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const bstr = e.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const jsonData = XLSX.utils.sheet_to_json<ImportedProperty>(ws);
      setData(jsonData);
      validateData(jsonData, statusOnlyImport);
      setStage("preview");
    };
    reader.readAsBinaryString(file);
  };

  const validateData = useCallback(
    (items: ImportedProperty[], statusOnly: boolean) => {
      const newErrors: string[] = [];
      if (items.length === 0) {
        newErrors.push("File appears to be empty.");
        setErrors(newErrors);
        return;
      }
      items.forEach((item, index) => {
        const sheetRow = index + 2;
        const parcel =
          item["Parcel ID"] !== undefined &&
          item["Parcel ID"] !== null &&
          String(item["Parcel ID"]).trim() !== "";
        const sale =
          item["Sale ID"] !== undefined &&
          item["Sale ID"] !== null &&
          String(item["Sale ID"]).trim() !== "";
        const status =
          item.Status !== undefined &&
          item.Status !== null &&
          String(item.Status).trim() !== "";

        if (statusOnly) {
          if (!parcel) {
            newErrors.push(`Row ${sheetRow}: Status-only mode requires Parcel ID.`);
          }
          if (!sale) {
            newErrors.push(`Row ${sheetRow}: Status-only mode requires Sale ID.`);
          }
          if (!status) {
            newErrors.push(`Row ${sheetRow}: Status-only mode requires Status.`);
          }
        } else {
          if (
            item.Title === undefined ||
            item.Title === null ||
            String(item.Title).trim() === ""
          ) {
            newErrors.push(`Row ${sheetRow}: Missing required Title.`);
          }
        }
      });
      setErrors(newErrors);
    },
    []
  );

  useEffect(() => {
    if (stage === "preview" && data.length > 0) {
      validateData(data, statusOnlyImport);
    }
  }, [statusOnlyImport, stage, data, validateData]);

  const handleUpload = async () => {
    if (!countyUserId) {
      alert("Please select a county user.");
      return;
    }
    setUploading(true);
    try {
      const res = await fetch("/api/properties/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          properties: data,
          countyUserId,
          statusOnly: statusOnlyImport,
        }),
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || "Upload failed");
      }

      let result: {
        inserted: number;
        updated: number;
        biddersLinked?: number;
        errors?: { row: number; message: string }[];
        warnings?: { row: number; message: string }[];
      };
      try {
        result = JSON.parse(text);
      } catch {
        throw new Error(text || "Invalid response");
      }

      const summary = [
        `Inserted: ${result.inserted}`,
        `Updated: ${result.updated}`,
      ];
      if (result.biddersLinked) {
        summary.push(`Bidders linked: ${result.biddersLinked}`);
      }
      if (result.warnings?.length) {
        summary.push(`Warnings: ${result.warnings.length}`);
      }
      if (result.errors?.length) {
        summary.push(`Rows not applied: ${result.errors.length}`);
        const preview = result.errors.slice(0, 5).map(
          (e) => `  Row ${e.row}: ${e.message}`
        );
        summary.push(...preview);
        if (result.errors.length > 5) summary.push(`  …and ${result.errors.length - 5} more`);
      }
      alert(summary.join("\n"));

      onSuccess();
      onClose();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Batch Import Properties
          </DialogTitle>
        </DialogHeader>

        {stage === "select" ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Import on behalf of County</Label>
              {loadingCounties ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading county users...
                </div>
              ) : (
                <Select value={countyUserId} onValueChange={setCountyUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a county user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {countyUsers.map((cu) => (
                      <SelectItem key={cu.id} value={cu.id}>
                        {cu.name || cu.email} ({cu.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="rounded-lg border bg-muted/50 p-5 text-center space-y-3">
              <p className="font-medium text-sm">Step 1: Download a template</p>
              <div className="flex justify-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadTemplate("xlsx")}
                >
                  <FileDown className="mr-1.5 h-4 w-4" />
                  Excel (.xlsx)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadTemplate("csv")}
                >
                  <FileDown className="mr-1.5 h-4 w-4" />
                  CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadTemplate("xls")}
                >
                  <FileDown className="mr-1.5 h-4 w-4" />
                  Excel 97-2003 (.xls)
                </Button>
              </div>
            </div>

            <div className="text-center space-y-3">
              <p className="font-medium text-sm">Step 2: Upload your file</p>
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="max-w-sm mx-auto"
              />
            </div>

            <div className="flex items-start gap-3 rounded-lg border bg-background p-4">
              <Checkbox
                id="status-only-import"
                checked={statusOnlyImport}
                onCheckedChange={(v) => setStatusOnlyImport(v === true)}
              />
              <div className="grid gap-1.5 leading-snug">
                <Label htmlFor="status-only-import" className="cursor-pointer font-medium">
                  Status-only rows (advanced)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Each row needs Parcel ID, Sale ID, and Status. Updates{" "}
                  <strong>status</strong> on existing listings for this county (match on both
                  IDs). Seed properties with a normal import first.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={parseFile}
                disabled={!file || !countyUserId}
              >
                <Upload className="mr-2 h-4 w-4" />
                Next: Preview
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {errors.length > 0 ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Validation Errors:</strong>
                  <ul className="list-disc ml-4 mt-1">
                    {errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Ready to import <strong>{data.length}</strong> row(s) for{" "}
                  <strong>
                    {countyUsers.find((c) => c.id === countyUserId)?.name ||
                      countyUsers.find((c) => c.id === countyUserId)?.email}
                  </strong>
                  {statusOnlyImport ? (
                    <>
                      {" "}
                      — <strong>status-only</strong> (existing Parcel ID + Sale ID).
                    </>
                  ) : (
                    <>
                      {" "}
                      — new rows merge on <strong>Parcel ID</strong> + <strong>Sale ID</strong>.
                    </>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
              <Checkbox
                id="status-only-preview"
                checked={statusOnlyImport}
                onCheckedChange={(v) => setStatusOnlyImport(v === true)}
              />
              <Label htmlFor="status-only-preview" className="cursor-pointer text-sm leading-snug font-normal">
                Status-only import (Parcel ID + Sale ID + Status)
              </Label>
            </div>

            <div className="max-h-[350px] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Title</TableHead>
                    <TableHead className="whitespace-nowrap">Sale ID</TableHead>
                    <TableHead className="whitespace-nowrap">Parcel ID</TableHead>
                    <TableHead className="whitespace-nowrap">Address</TableHead>
                    <TableHead className="whitespace-nowrap">City</TableHead>
                    <TableHead className="whitespace-nowrap">Zip Code</TableHead>
                    <TableHead className="whitespace-nowrap">Min Bid</TableHead>
                    <TableHead className="whitespace-nowrap">Winning Bid</TableHead>
                    <TableHead className="whitespace-nowrap">Bidder email</TableHead>
                    <TableHead className="whitespace-nowrap">Bidder #</TableHead>
                    <TableHead className="whitespace-nowrap">Auction start</TableHead>
                    <TableHead className="whitespace-nowrap">Auction end</TableHead>
                    <TableHead className="whitespace-nowrap">Owners</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.slice(0, 50).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="whitespace-nowrap">
                        {!statusOnlyImport &&
                        (!row.Title || String(row.Title).trim() === "") ? (
                          <span className="text-destructive font-medium">
                            Missing
                          </span>
                        ) : (
                          row.Title || "—"
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row["Sale ID"] || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row["Parcel ID"] || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row.Address || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row.City || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row["Zip Code"] || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row["Minimum Bid"] || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row["Winning Bid"] || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap max-w-[140px] truncate" title={row["Bidder Email"]}>
                        {(row["Bidder Email"] as string | undefined) || (row["Winning Bidder Email"] as string | undefined) || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {(row["Bidder Number"] as string | undefined) || (row["Winning Bidder Number"] as string | undefined) || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {(row["Auction Start Date"] as string | undefined) || (row["Redemption End Date"] as string | undefined) || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row["Auction End Date"] || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row.Owners || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row.Status ? (
                          <Badge variant="outline">{row.Status}</Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {data.length > 50 && (
                <p className="text-center text-sm text-muted-foreground py-2">
                  And {data.length - 50} more...
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setStage("select")}
                disabled={uploading}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={handleUpload}
                disabled={errors.length > 0 || uploading}
              >
                {uploading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {uploading ? "Importing..." : "Import Properties"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
