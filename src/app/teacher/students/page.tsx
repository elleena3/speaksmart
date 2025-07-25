
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/auth-context';
import { type UserData } from '@/lib/types';
import { Loader2, User, ChevronsUpDown, Check, Edit, Mail, KeyRound, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const auth = getAuth();

const editFormSchema = z.object({
  grade: z.string().min(1, '학년을 입력해주세요.'),
  class: z.string().min(1, '반을 입력해주세요.'),
  number: z.string().min(1, '번호를 입력해주세요.'),
});

function StudentManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const [students, setStudents] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<{ grade: string, class: string }>({ grade: 'all', class: 'all' });
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<UserData | null>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof editFormSchema>>({
    resolver: zodResolver(editFormSchema),
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;

    const fetchStudents = async () => {
      setIsLoading(true);
      const q = query(collection(db, "users"), where("role", "==", "student"));
      const querySnapshot = await getDocs(q);
      const studentList = querySnapshot.docs.map(doc => doc.data() as UserData);
      studentList.sort((a,b) => (a.displayName).localeCompare(b.displayName));
      setStudents(studentList);
      setIsLoading(false);
    };
    fetchStudents();
  }, [user, authLoading]);

  useEffect(() => {
    if (selectedStudent) {
      form.reset({
        grade: selectedStudent.grade || '',
        class: selectedStudent.class || '',
        number: selectedStudent.number || '',
      });
    }
  }, [selectedStudent, form]);

  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const gradeMatch = filter.grade === 'all' || student.grade === filter.grade;
      const classMatch = filter.class === 'all' || student.class === filter.class;
      const nameMatch = student.displayName.toLowerCase().includes(searchTerm.toLowerCase());
      return gradeMatch && classMatch && nameMatch;
    });
  }, [students, filter, searchTerm]);

  const uniqueGrades = useMemo(() => ['all', ...Array.from(new Set(students.map(s => s.grade || ''))).filter(g => g)], [students]);
  const uniqueClasses = useMemo(() => ['all', ...Array.from(new Set(students.map(s => s.class || ''))).filter(c => c)], [students]);

  const handleEditStudent = (student: UserData) => {
    setSelectedStudent(student);
    setIsEditDialogOpen(true);
  };
  
  const handlePasswordReset = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      toast({
        title: "비밀번호 재설정 이메일 발송",
        description: `${email}으로 비밀번호를 재설정할 수 있는 링크를 보냈습니다.`,
      });
    } catch (error) {
      console.error("Password reset error:", error);
      toast({
        title: "오류",
        description: "비밀번호 재설정 이메일을 보내는 데 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const onEditSubmit = async (values: z.infer<typeof editFormSchema>) => {
    if (!selectedStudent) return;
    
    try {
      const studentRef = doc(db, "users", selectedStudent.uid);
      await updateDoc(studentRef, {
        grade: values.grade,
        class: values.class,
        number: values.number,
      });

      setStudents(prev => prev.map(s => s.uid === selectedStudent.uid ? { ...s, ...values } : s));
      toast({ title: "성공", description: "학생 정보가 업데이트되었습니다." });
      setIsEditDialogOpen(false);
      setSelectedStudent(null);
    } catch (error) {
      console.error("Error updating student:", error);
      toast({ title: "오류", description: "정보 업데이트에 실패했습니다.", variant: "destructive" });
    }
  };

  if (isLoading || authLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>학생 관리</CardTitle>
          <CardDescription>등록된 모든 학생 목록입니다. 정보를 수정하거나 비밀번호를 재설정할 수 있습니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <FilterCombobox label="학년" options={uniqueGrades} value={filter.grade} onSelect={(value) => setFilter({ ...filter, grade: value, class: 'all' })} />
            <FilterCombobox label="반" options={uniqueClasses} value={filter.class} onSelect={(value) => setFilter({ ...filter, class: value })} />
            <div className="relative ml-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="이름으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full max-w-sm"
              />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead className="text-center">학년</TableHead>
                <TableHead className="text-center">반</TableHead>
                <TableHead className="text-center">번호</TableHead>
                <TableHead>이메일</TableHead>
                <TableHead className="text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.map(student => (
                <TableRow key={student.uid}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={student.photoURL} alt={student.displayName} />
                        <AvatarFallback>{student.displayName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{student.displayName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">{student.grade || '-'}</TableCell>
                  <TableCell className="text-center">{student.class || '-'}</TableCell>
                  <TableCell className="text-center">{student.number || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{student.email}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleEditStudent(student)}><Edit className="mr-2 h-4 w-4"/>정보 수정</Button>
                    <Button variant="secondary" size="sm" onClick={() => handlePasswordReset(student.email)}><KeyRound className="mr-2 h-4 w-4"/>비번 초기화</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredStudents.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              해당 조건의 학생이 없습니다.
            </div>
          )}
        </CardContent>
      </Card>
      
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>학생 정보 수정</DialogTitle>
            <DialogDescription>{selectedStudent?.displayName} 학생의 정보를 수정합니다.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onEditSubmit)} className="space-y-4 py-4">
               <FormField control={form.control} name="grade" render={({ field }) => (
                  <FormItem><FormLabel>학년</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
               <FormField control={form.control} name="class" render={({ field }) => (
                  <FormItem><FormLabel>반</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
               <FormField control={form.control} name="number" render={({ field }) => (
                  <FormItem><FormLabel>번호</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="secondary">취소</Button></DialogClose>
                <Button type="submit">저장</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterCombobox({ label, options, value, onSelect }: { label: string, options: string[], value: string, onSelect: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const displayValue = value === 'all' ? `모든 ${label}` : `${value}${label.endsWith('반') ? '반' : '학년'}`;
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-[180px] justify-between">
          {displayValue}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[180px] p-0">
        <Command>
          <CommandInput placeholder={`${label} 검색...`} />
          <CommandList>
            <CommandEmpty>결과 없음.</CommandEmpty>
            <CommandGroup>
              {options.map(option => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={(currentValue) => {
                    onSelect(currentValue === value ? value : currentValue);
                    setOpen(false);
                  }}
                >
                  <Check className={`mr-2 h-4 w-4 ${value === option ? 'opacity-100' : 'opacity-0'}`} />
                  {option === 'all' ? `모든 ${label}` : option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default StudentManagementPage;
