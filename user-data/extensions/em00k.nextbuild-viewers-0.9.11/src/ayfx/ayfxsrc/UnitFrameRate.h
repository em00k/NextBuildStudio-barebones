//---------------------------------------------------------------------------

#ifndef UnitFrameRateH
#define UnitFrameRateH
//---------------------------------------------------------------------------
#include <Classes.hpp>
#include <Controls.hpp>
#include <StdCtrls.hpp>
#include <Forms.hpp>
//---------------------------------------------------------------------------
class TFormFrameRate : public TForm
{
__published:	// IDE-managed Components
	TEdit *EditFrameRate;
	TButton *Button1;
	TButton *Button2;
	void __fastcall EditFrameRateKeyPress(TObject *Sender, char &Key);
	void __fastcall EditFrameRateChange(TObject *Sender);
	void __fastcall FormCreate(TObject *Sender);
	void __fastcall Button1Click(TObject *Sender);
	void __fastcall Button2Click(TObject *Sender);
private:	// User declarations
public:		// User declarations
	__fastcall TFormFrameRate(TComponent* Owner);

	bool Confirm;
};
//---------------------------------------------------------------------------
extern PACKAGE TFormFrameRate *FormFrameRate;
//---------------------------------------------------------------------------
#endif
