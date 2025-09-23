import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const createRequirementSchema = z.object({
  text: z.string().min(10, 'Kravtext måste vara minst 10 tecken'),
  requirement_type: z.enum(['Skall', 'Bör']),
  requirement_category: z.string().optional(),
  import_organization: z.string().min(1, 'Organisation krävs'),
  user_comment: z.string().optional(),
  user_status: z.enum(['OK', 'Under utveckling', 'Senare'])
});

type CreateRequirementForm = z.infer<typeof createRequirementSchema>;

interface CreateRequirementDialogProps {
  onRefresh?: () => void;
}

export function CreateRequirementDialog({ onRefresh }: CreateRequirementDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<CreateRequirementForm>({
    resolver: zodResolver(createRequirementSchema),
    defaultValues: {
      text: '',
      requirement_type: 'Skall',
      requirement_category: '',
      import_organization: '',
      user_comment: '',
      user_status: 'OK'
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateRequirementForm) => {
      const response = await fetch('/api/requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create requirement');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Krav skapat',
        description: 'Det nya kravet har skapats framgångsrikt.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/requirements'] });
      form.reset();
      setOpen(false);
      onRefresh?.();
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Fel vid skapande',
        description: error.message,
      });
    }
  });

  const onSubmit = (data: CreateRequirementForm) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="button-create-requirement">
          <Plus className="h-4 w-4" />
          Skapa nytt krav
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Skapa nytt krav</DialogTitle>
          <DialogDescription>
            Lägg till ett nytt krav i systemet. Alla fält markerade med * krävs.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kravtext *</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Skriv kravtexten här..."
                      className="min-h-[100px]"
                      data-testid="textarea-requirement-text"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="requirement_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kravtyp *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-requirement-type">
                          <SelectValue placeholder="Välj kravtyp" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Skall">Skall</SelectItem>
                        <SelectItem value="Bör">Bör</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="user_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-user-status">
                          <SelectValue placeholder="Välj status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="OK">OK</SelectItem>
                        <SelectItem value="Under utveckling">Under utveckling</SelectItem>
                        <SelectItem value="Senare">Senare</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="import_organization"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organisation *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="T.ex. Malmö Stad"
                        data-testid="input-organization"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="requirement_category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kategori</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="T.ex. Säkerhet, Integration"
                        data-testid="input-category"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="user_comment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kommentar</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Frivillig kommentar om kravet..."
                      className="min-h-[60px]"
                      data-testid="textarea-comment"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setOpen(false)}
                disabled={createMutation.isPending}
              >
                Avbryt
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending}
                data-testid="button-submit-requirement"
              >
                {createMutation.isPending ? 'Skapar...' : 'Skapa krav'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}