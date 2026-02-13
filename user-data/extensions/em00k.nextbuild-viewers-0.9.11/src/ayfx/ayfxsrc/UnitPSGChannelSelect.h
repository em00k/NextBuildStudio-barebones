//---------------------------------------------------------------------------

#ifndef UnitPSGChannelSelectH
#define UnitPSGChannelSelectH
//---------------------------------------------------------------------------
#include <Classes.hpp>
#include <Controls.hpp>
#include <StdCtrls.hpp>
#include <Forms.hpp>
//---------------------------------------------------------------------------
class TFormPSGChannelSelect : public TForm
{
__published:	// IDE-managed Components
	TRadioButton *RadioButtonChAuto;
	TRadioButton *RadioButtonChTone0;
	TRadioButton *RadioButtonChTone1;
	TRadioButton *RadioButtonChTone2;
	TRadioButton *RadioButtonChNoise;
	TCheckBox *CheckBoxMixNoise;
	TButton *ButtonOK;
	TButton *ButtonCancel;
	void __fastcall ButtonOKClick(TObject *Sender);
	void __fastcall ButtonCancelClick(TObject *Sender);
	void __fastcall RadioButtonChAutoClick(TObject *Sender);
	void __fastcall FormCreate(TObject *Sender);
private:	// User declarations
public:		// User declarations
	__fastcall TFormPSGChannelSelect(TComponent* Owner);
        void __fastcall UpdateVGMSet(void);
};
//---------------------------------------------------------------------------
extern PACKAGE TFormPSGChannelSelect *FormPSGChannelSelect;
//---------------------------------------------------------------------------
#endif
